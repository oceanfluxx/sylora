const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const ganache = require('ganache');
const { ethers } = require('ethers');

const mnemonic = 'test test test test test test test test test test test junk';
const artifact = name => ({abi:JSON.parse(fs.readFileSync(path.join(__dirname,'build',name+'.abi.json'))),bytecode:fs.readFileSync(path.join(__dirname,'build',name+'.bin'),'utf8').trim()});
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  const chain = ganache.server({chain:{chainId:968},wallet:{mnemonic},logging:{quiet:true}});
  await chain.listen(0,'127.0.0.1');
  console.log('Local chain started');
  let child, tmp;
  try{
    const rpc=`http://127.0.0.1:${chain.address().port}`;
    const provider=new ethers.JsonRpcProvider(rpc);
    const wallet=i=>ethers.HDNodeWallet.fromPhrase(mnemonic,null,`m/44'/60'/0'/0/${i}`).connect(provider);
    const owner=new ethers.NonceManager(wallet(0)), participant=wallet(1), stranger=wallet(2);
    const regArt=artifact('EcoActionRegistry'), tokArt=artifact('SylToken');
    const reg=await new ethers.ContractFactory(regArt.abi,regArt.bytecode,owner).deploy(false);await reg.waitForDeployment();
    const token=await new ethers.ContractFactory(tokArt.abi,tokArt.bytecode,owner).deploy(await reg.getAddress());await token.waitForDeployment();
    await (await reg.setToken(await token.getAddress())).wait();
    assert.equal(await reg.supportsActionType('like_x'),true,'registry supports daily challenge types');
    assert.equal(await reg.supportsActionType('unknown_challenge'),false,'registry rejects unknown challenge types');
    console.log('Contracts deployed');
    const port=18080+Math.floor(Math.random()*20000);
    tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sylora-queue-'));
    child=spawn(process.execPath,[path.join(__dirname,'server.js')],{env:{...process.env,PORT:String(port),RPC_URL:rpc,CHAIN_ID:'968',REGISTRY_ADDRESS:await reg.getAddress(),TOKEN_ADDRESS:await token.getAddress(),SYLORA_DATA_DIR:tmp,SUBMISSION_RATE_LIMIT_MS:'0'},stdio:'ignore',windowsHide:true});
    const base=`http://127.0.0.1:${port}`;
    let ready=false;
    for(let i=0;i<40;i++){try{const r=await fetch(base+'/api/config');ready=(await r.json()).ready;if(ready)break}catch{}await wait(100)}
    assert.equal(ready,true,'queue server starts');
    console.log('Queue server started');
    const photo='data:image/png;base64,'+Buffer.from('89504e470d0a1a0a'+'00000000','hex').toString('base64');
    const post=async (actionType,description)=>fetch(base+'/api/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submitter:participant.address,actionType,description,photo})});
    const first=await post('tree_planting','Planted a tree');assert.equal(first.status,201);
    const item=(await first.json()).item;
    console.log('First submission stored');
    assert.equal((await fetch(base+'/api/photos/'+item.id)).status,200);
    assert.equal((await post('tree_planting','Duplicate')).status,409,'duplicate pending type blocked');
    const approve=()=>reg.connect(owner).reviewQueuedAction(item.id,item.submitter,item.actionType,item.description,item.imageHash,true);
    await assert.rejects(reg.connect(stranger).reviewQueuedAction.staticCall(item.id,item.submitter,item.actionType,item.description,item.imageHash,true),'only verifier reviews');
    const balance=await provider.getBalance(participant.address);
    const tx=await approve();await tx.wait();
    console.log('Approval mined');
    assert.equal(await provider.getBalance(participant.address),balance,'participant pays no gas');
    assert.equal(await token.balanceOf(participant.address),50n*10n**18n);
    await assert.rejects(reg.connect(owner).reviewQueuedAction.staticCall(item.id,item.submitter,item.actionType,item.description,item.imageHash,true),'request replay blocked');
    const dailyTypes=['like_x','comment_x','repost_x'];
    for(const actionType of dailyTypes){
      const requestId=ethers.id('daily-'+actionType);
      const description=`[Challenge:${actionType}] Daily engagement test`;
      const dailyTx=await reg.connect(owner).reviewQueuedAction(requestId,participant.address,actionType,description,ethers.id(actionType+'.png'),true,{gasLimit:1_000_000});
      await dailyTx.wait();
    }
    assert.equal(await token.balanceOf(participant.address),200n*10n**18n,'all three daily tasks reward independently');
    await assert.rejects(
      reg.connect(owner).reviewQueuedAction.staticCall(ethers.id('repeat-like'),participant.address,'like_x','[Challenge:like_x] Repeat',ethers.id('repeat.png'),true),
      'each daily task keeps its own 24-hour cooldown'
    );
    await provider.send('evm_increaseTime',[24*60*60+1]);
    await provider.send('evm_mine',[]);
    const repeatTx=await reg.connect(owner).reviewQueuedAction(ethers.id('repeat-like'),participant.address,'like_x','[Challenge:like_x] Repeat',ethers.id('repeat.png'),true,{gasLimit:1_000_000});
    await repeatTx.wait();
    assert.equal(await token.balanceOf(participant.address),250n*10n**18n,'daily task is available again after 24 hours');
    console.log('Three daily tasks approved independently; repeat task unlocks after 24 hours');
    const reconciled=await fetch(base+'/api/submissions?wallet='+participant.address);
    assert.equal((await reconciled.json()).items[0].status,'approved','queue recovers if the browser misses the sync request');
    const reviewed=await fetch(base+`/api/submissions/${item.id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txHash:tx.hash})});
    assert.equal(reviewed.status,200);
    assert.equal((await reviewed.json()).item.status,'approved');
    console.log('Approval synced');
    console.log('Submitting rejection case');
    const second=await post('like_x','[Challenge:like_x] Rejected challenge proof');assert.equal(second.status,201,'queue accepts challenge-specific action types');
    const rejectItem=(await second.json()).item;
    console.log('Rejection item stored');
    const rejectTx=await reg.connect(owner).reviewQueuedAction(rejectItem.id,rejectItem.submitter,rejectItem.actionType,rejectItem.description,rejectItem.imageHash,false);await rejectTx.wait();
    console.log('Rejection mined');
    const rejected=await fetch(base+`/api/submissions/${rejectItem.id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({txHash:rejectTx.hash})});
    assert.equal(rejected.status,200);
    assert.equal((await rejected.json()).item.status,'rejected');
    assert.equal(await token.balanceOf(participant.address),250n*10n**18n);
    for(const actionType of ['like_x','comment_x','repost_x','eco_post_x']){
      const challenge=await post(actionType,`[Challenge:${actionType}] Independent pending task`);
      assert.equal(challenge.status,201,`${actionType} can be pending alongside other challenge tasks`);
    }
    assert.equal((await post('eco_post_x','[Challenge:eco_post_x] Duplicate weekly task')).status,409,'duplicate weekly task is blocked while pending');
    console.log('Daily and weekly challenge tasks can remain pending together');
    console.log('Queue submission, photo, verifier approval/rejection, replay protection, and no participant gas passed');
  } finally {
    if(child)child.kill();
    if(tmp)fs.rmSync(tmp,{recursive:true,force:true});
    await chain.close();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
