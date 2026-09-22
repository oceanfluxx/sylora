// Sylora demo server: shared submission queue and static frontend.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ethers } = require('ethers');

const root = path.resolve(__dirname, '../frontend');
const dataDir = path.resolve(process.env.SYLORA_DATA_DIR || path.join(__dirname, 'data'));
const queueFile = path.join(dataDir, 'queue.json');
const photoDir = path.join(dataDir, 'photos');
const port = Number(process.env.PORT || 8080);
const registryAddress = process.env.REGISTRY_ADDRESS || '';
const tokenAddress = process.env.TOKEN_ADDRESS || '';
const rpc = process.env.RPC_URL || 'https://rpc.bohr.life';
const provider = new ethers.JsonRpcProvider(rpc);
const iface = new ethers.Interface(['function reviewQueuedAction(bytes32,address,string,string,bytes32,bool) returns (bytes32)']);
const registry = ethers.isAddress(registryAddress) ? new ethers.Contract(registryAddress, [
  'function reviewedRequests(bytes32) view returns (bool)',
  'function actions(bytes32) view returns (address,string,string,bytes32,uint64,uint8,address,uint256,uint16)',
  'function syl() view returns (address)'
], provider) : null;
const types = new Set(['tree_planting','beach_cleanup','recycle','compost','other']);
const rate = new Map();
fs.mkdirSync(photoDir, {recursive:true});
let queue = fs.existsSync(queueFile) ? JSON.parse(fs.readFileSync(queueFile, 'utf8')) : [];

function save() {
  const tmp = queueFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(queue, null, 2));
  fs.renameSync(tmp, queueFile);
}
function send(res, code, body) {
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(body));
}
function fail(res, code, message) { send(res, code, {error:message}); }
async function body(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 7 * 1024 * 1024) throw new Error('Request exceeds 7 MB');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function publicItem(item) {
  const {id,submitter,actionType,description,imageHash,submittedAt,status,txHash} = item;
  return {id,submitter,actionType,description,imageHash,submittedAt,status,txHash,photoUrl:`/api/photos/${id}`};
}
async function reconcileQueue(){
  if(!registry)return;
  let changed=false;
  for(const item of queue.filter(x=>x.status==='pending')){
    if(!await registry.reviewedRequests(item.id))continue;
    const actionId=ethers.solidityPackedKeccak256(['address','bytes32'],[registryAddress,item.id]);
    const action=await registry.actions(actionId);
    item.status=Number(action[5])===1?'approved':'rejected';
    item.reviewedAt=Date.now();changed=true;
  }
  if(changed)save();
}
function validPhoto(bytes, mime) {
  return bytes.length > 0 && bytes.length <= 5 * 1024 * 1024 && (
    mime === 'image/png' && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) ||
    mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length-2] === 0xff && bytes[bytes.length-1] === 0xd9
  );
}
async function handle(req,res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/config' && req.method === 'GET') {
    return send(res,200,{ready:!!registry && ethers.isAddress(tokenAddress),registry:registryAddress,token:tokenAddress,chainId:968});
  }
  if (url.pathname === '/api/submissions' && req.method === 'GET') {
    await reconcileQueue();
    const wallet = url.searchParams.get('wallet');
    if (wallet && !ethers.isAddress(wallet)) return fail(res,400,'Invalid wallet address');
    return send(res,200,{items:queue.filter(x=>!wallet || x.submitter.toLowerCase()===wallet.toLowerCase()).map(publicItem)});
  }
  if (url.pathname === '/api/submissions' && req.method === 'POST') {
    if (!registry || !ethers.isAddress(tokenAddress)) return fail(res,503,'New registry and token are not configured');
    const ip = req.socket.remoteAddress || 'unknown';
    if (Date.now() - (rate.get(ip)||0) < 5000) return fail(res,429,'Wait a few seconds before submitting again');
    const input = await body(req);
    const submitter = String(input.submitter||'');
    const actionType = String(input.actionType||'');
    const description = String(input.description||'').trim();
    if (!ethers.isAddress(submitter) || !types.has(actionType) || !description || Buffer.byteLength(description)>280) return fail(res,400,'Invalid wallet, action, or description');
    const pending = queue.filter(x=>x.status==='pending' && x.submitter.toLowerCase()===submitter.toLowerCase());
    if (pending.length>=3 || pending.some(x=>x.actionType===actionType)) return fail(res,409,'This wallet already has a pending action of this type, or three pending actions');
    const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(input.photo||''));
    if (!match) return fail(res,400,'Upload a JPG or PNG photo');
    const bytes = Buffer.from(match[2], 'base64');
    if (!validPhoto(bytes,match[1])) return fail(res,400,'Invalid photo or photo exceeds 5 MB');
    const id = ethers.hexlify(crypto.randomBytes(32));
    const ext = match[1]==='image/png' ? '.png' : '.jpg';
    const item = {id,submitter:ethers.getAddress(submitter),actionType,description,imageHash:ethers.keccak256(bytes),submittedAt:Date.now(),status:'pending',photoFile:id.slice(2)+ext,mime:match[1]};
    fs.writeFileSync(path.join(photoDir,item.photoFile),bytes,{flag:'wx'});
    queue.push(item); save(); rate.set(ip,Date.now());
    return send(res,201,{item:publicItem(item)});
  }
  const photoMatch = /^\/api\/photos\/(0x[0-9a-fA-F]{64})$/.exec(url.pathname);
  if (photoMatch && req.method==='GET') {
    const item = queue.find(x=>x.id===photoMatch[1]);
    if (!item) return fail(res,404,'Photo not found');
    res.writeHead(200,{'Content-Type':item.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    return fs.createReadStream(path.join(photoDir,item.photoFile)).pipe(res);
  }
  const reviewMatch = /^\/api\/submissions\/(0x[0-9a-fA-F]{64})\/review$/.exec(url.pathname);
  if (reviewMatch && req.method==='POST') {
    if (!registry) return fail(res,503,'Registry is not configured');
    const item = queue.find(x=>x.id===reviewMatch[1]);
    if (!item) return fail(res,404,'Submission not found');
    const {txHash} = await body(req);
    if (!ethers.isHexString(txHash,32)) return fail(res,400,'Invalid transaction hash');
    const [tx,receipt] = await Promise.all([provider.getTransaction(txHash),provider.getTransactionReceipt(txHash)]);
    if (!tx || !receipt || receipt.status!==1 || tx.to?.toLowerCase()!==registryAddress.toLowerCase()) return fail(res,400,'Review transaction is not confirmed on the configured registry');
    let args;
    try { args=iface.parseTransaction({data:tx.data,value:tx.value}).args; } catch { return fail(res,400,'Transaction is not a queue review'); }
    if (args[0]!==item.id || args[1].toLowerCase()!==item.submitter.toLowerCase() || args[2]!==item.actionType || args[3]!==item.description || args[4]!==item.imageHash) return fail(res,400,'Transaction does not match this submission');
    const actionId = ethers.solidityPackedKeccak256(['address','bytes32'],[registryAddress,item.id]);
    const action = await registry.actions(actionId);
    if (action[0].toLowerCase()!==item.submitter.toLowerCase() || Number(action[5])!==(args[5]?1:2)) return fail(res,400,'On-chain review result does not match');
    item.status=args[5]?'approved':'rejected'; item.txHash=txHash; item.reviewedAt=Date.now(); save();
    return send(res,200,{item:publicItem(item)});
  }
  if (req.method!=='GET' && req.method!=='HEAD') return fail(res,405,'Method not allowed');
  const file = path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(res,404,'Not found');
  const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff'});
  fs.createReadStream(file).pipe(res);
}
http.createServer((req,res)=>handle(req,res).catch(e=>{console.error(e);if(!res.headersSent)fail(res,500,'Server error');else res.end();})).listen(port,()=>console.log(`Sylora running at http://localhost:${port}`));
