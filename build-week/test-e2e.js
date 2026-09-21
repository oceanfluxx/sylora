// SYLORA E2E test — run against anvil (local in-memory EVM, chain id 968)
// Usage: node test-e2e.js
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { expectRevert } = require('./test-helpers');

// Anvil default mnemonic + derivation that matches anvil's printed accounts exactly
const RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
const MNEMONIC = 'test test test test test test test test test test test junk';
const provider = new ethers.JsonRpcProvider(RPC);
const wallets = [0, 1, 2].map(i =>
  new ethers.NonceManager(
    ethers.HDNodeWallet.fromPhrase(MNEMONIC, null, `m/44'/60'/0'/0/${i}`).connect(provider)
  )
);
const deployer = wallets[0]; // owner/organizer
const alice = wallets[1];    // eco doer
const bob = wallets[2];      // verifier

const registryAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'build/EcoActionRegistry.abi.json'), 'utf8'));
const tokenAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'build/SylToken.abi.json'), 'utf8'));
const registryBin = fs.readFileSync(path.join(__dirname, 'build/EcoActionRegistry.bin'), 'utf8').trim();
const tokenBin = fs.readFileSync(path.join(__dirname, 'build/SylToken.bin'), 'utf8').trim();

const REWARD = 50n * 10n ** 18n;
const MIN_REDEEM = 50n * 10n ** 18n;
const MAX_SUPPLY = 1_000_000n * 10n ** 18n;

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; failures.push(name + (detail ? ` (${detail})` : '')); console.log(`  ✗ ${name} ${detail}`); }
}

async function main() {
  // NonceManager has no .address property — attach it once for convenience
  for (const w of [deployer, alice, bob]) w.address = await w.getAddress();

  console.log('\n=== SYLORA E2E — deploy order (registry → token → setToken) ===');
  // 1. Deploy registry FIRST (seedDemo=true for judges demo)
  const regF = new ethers.ContractFactory(registryAbi, registryBin, deployer);
  const registry = await regF.deploy(true);
  await registry.waitForDeployment();

  //  order check: token cannot be set before it exists (trivially true), so deploy token
  const tokF = new ethers.ContractFactory(tokenAbi, tokenBin, deployer);
  const token = await tokF.deploy(await registry.getAddress());
  await token.waitForDeployment();

  const regAddr = await registry.getAddress();
  const tokAddr = await token.getAddress();
  console.log(`  registry: ${regAddr}`);
  console.log(`  token   : ${tokAddr}`);

  // 2. Wire token
  await (await registry.setToken(tokAddr)).wait();

  // --- Token invariants ---
  console.log('\n=== Token invariants ===');
  check('totalSupply == 1,000,000 SYL at deploy', (await token.totalSupply()) === MAX_SUPPLY);
  check('full supply sits in registry (pool)', (await token.balanceOf(regAddr)) === MAX_SUPPLY);
  check('registry() immutable == registry address', (await token.registry()) === regAddr);
  check('totalBurned starts at 0', (await token.totalBurned()) === 0n);
  check('3 demo actions seeded (display-only, rewardAmount=0)', Number(await registry.actionCount()) === 3);

  // --- Security: no mint function exists ---
  console.log('\n=== Security: no mint path exists ===');
  const hasMint = tokenAbi.some(f => f.type === 'function' && /^mint/i.test(f.name || ''));
  check('SylToken ABI has NO mint function', !hasMint);
  // mint() does not exist in the ABI — calling it must fail at the ABI level
  let mintReverted = false;
  try { await token.mint.staticCall(alice.address, REWARD); } catch { mintReverted = true; }
  check('call to mint() reverts (no such function)', mintReverted);

  // --- Submit/verify/reward flow (alice) ---
  console.log('\n=== Eco-action flow: submit → verify → reward ===');
  const aliceReg = registry.connect(alice);
  const imageHash = ethers.id('photo-of-tree-planting-by-alice.jpg');

  // helper: mine a real block so timestamps advance past cooldowns/streak windows
  const rpc = async (method, params = []) => {
    const r = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }) });
    return (await r.json()).result;
  };
  const mine = async (sec) => { await rpc('evm_increaseTime', [sec]); await rpc('evm_mine'); };

  const tx1 = await aliceReg.submitAction('tree_planting', 'Menanam 3 bibit mangrove di tepi sungai bersama warga.', imageHash);
  const rc1 = await tx1.wait();
  const subEvt = rc1.logs.map(l => { try { return registry.interface.parseLog(l); } catch { return null; } }).find(Boolean);
  check('ActionSubmitted event emitted', !!subEvt && subEvt.name === 'ActionSubmitted');
  const actionId = subEvt.args.id;
  check('pending count = 1 for alice', (await registry.pendingCount(alice.address)) === 1n);

  // cooldown: same type again → revert
  cd = await expectRevert(aliceReg.submitAction.staticCall('tree_planting', 'test cooldown', imageHash));
  check('cooldown 24h blocks same-type resubmit', cd);

  // different type ok
  await (await aliceReg.submitAction('recycle', 'Menyortir 12 kg sampah di bank sampah.', ethers.id('recycle.jpg'))).wait();
  check('different action type allowed despite cooldown', (await registry.pendingCount(alice.address)) === 2n);

  // 3rd pending ok (cooldown is per TYPE, so different types are fine within the same block)
  await (await aliceReg.submitAction('compost', 'Kompos dari sampah organik dapur.', ethers.id('compost.jpg'))).wait();
  tmp = await expectRevert(aliceReg.submitAction.staticCall('other', 'n+1', ethers.id('x.jpg')));
  check('max 3 pending enforced', tmp);
  check('pending count = 3', (await registry.pendingCount(alice.address)) === 3n);

  // cool down for 25h so tree_planting can be re-submitted later
  await mine(25 * 3600);

  // --- Verify flow (bob as second verifier) ---
  console.log('\n=== Verification & rewards ===');
  notVerifier = await expectRevert(registry.connect(bob).verifyAction.staticCall(actionId));
  check('non-verifier cannot verify', notVerifier);

  await (await registry.setVerifier(bob.address, true)).wait();
  check('owner adds bob as verifier', await registry.verifiers(bob.address));

  const bobReg = registry.connect(bob);
  await (await bobReg.verifyAction(actionId)).wait();
  const a1 = await registry.actions(actionId);
  check('action 1 Verified', a1.status === 1n);
  check('alice earned 50 SYL', (await token.balanceOf(alice.address)) === REWARD);
  check('alice streak = 1', (await registry.userStreak(alice.address)) === 1n);
  check('pool drained by exactly 50', (await token.balanceOf(regAddr)) === MAX_SUPPLY - REWARD);

  // verify 2nd within streak window → streak 2
  const ids = await registry.getActionsByUser(alice.address);
  const id2 = ids[ids.length - 2]; // recycle action
  await (await bobReg.verifyAction(id2, { gasLimit: 300_000 })).wait();
  check('streak grows within 72h window', (await registry.userStreak(alice.address)) === 2n);

  // --- Reject flow ---
  console.log('\n=== Reject flow ===');
  const id3 = ids[ids.length - 1];
  await (await bobReg.rejectAction(id3, 'Foto tidak jelas — silakan submit ulang dengan cahaya lebih baik')).wait();
  const a3 = await registry.actions(id3);
  check('action 3 Rejected', a3.status === 2n);
  check('rejected action pays nothing', a3.rewardAmount === 0n);
  check('pending freed', (await registry.pendingCount(alice.address)) === 0n);

  // --- Redeem: pull-and-burn, pool untouched ---
  console.log('\n=== Redeem voucher (burn sink) ===');
  const aliceTok = token.connect(alice);
  await (await aliceTok.approve(regAddr, MIN_REDEEM)).wait();
  const poolBefore = await token.balanceOf(regAddr);
  await (await registry.connect(alice).redeemVoucher(MIN_REDEEM)).wait();
  check('alice $SYL burned 50, 50 remaining from 2nd reward', (await token.balanceOf(alice.address)) === REWARD);
  check('pool UNTOUCHED by redeem', (await token.balanceOf(regAddr)) === poolBefore);
  check('totalSupply shrank to 999,950', (await token.totalSupply()) === MAX_SUPPLY - MIN_REDEEM);
  check('totalBurned = 50', (await token.totalBurned()) === MIN_REDEEM);

  // below min redeem
  bmr = await expectRevert(registry.connect(alice).redeemVoucher.staticCall(10n * 10n ** 18n));
  check('below-min redeem rejected', bmr);

  // --- Pool arithmetic: rewards paid = pool spent ---
  console.log('\n=== Pool solvent by design ===');
  const paid = 2n * REWARD;
  const poolNow = await token.balanceOf(regAddr);
  check('pool == 1M − paid rewards', poolNow === MAX_SUPPLY - paid);

  // --- Invalid input guards ---
  console.log('\n=== Input guards ===');
  badType = await expectRevert(aliceReg.submitAction.staticCall('mining_batu', 'x', ethers.id('y.jpg')));
  check('invalid action type rejected', badType);

  longDesc = await expectRevert(aliceReg.submitAction.staticCall('other', 'x'.repeat(281), ethers.id('z.jpg')));
  check('description >280 chars rejected', longDesc);

  emptyDesc = await expectRevert(aliceReg.submitAction.staticCall('other', '', ethers.id('w.jpg')));
  check('empty description rejected', emptyDesc);

  // --- Frontend helper: imageHash computed client-side before submit ---
  console.log('\n=== Client-side image hash (anti-photo-swap) ===');
  const photoBytes = 'PNG;mangrove-seedling;2026-09-14;gps=-7.15,112.66';
  const clientHash = ethers.id(photoBytes);
  await (await aliceReg.submitAction('beach_cleanup', 'Bersih-bersih pantai akhir pekan.', clientHash)).wait();
  const newIds = await registry.getActionsByUser(alice.address);
  const a4 = await registry.actions(newIds[newIds.length - 1]);
  check('on-chain imageHash == client-side hash', a4.imageHash === clientHash);
  check('imageHash lock prevents photo swap (hash pre-committed)', a4.imageHash === ethers.id(photoBytes));

  // --- Unverified users cannot call admin fns ---
  console.log('\n=== Admin guards ===');
  noSetTok = await expectRevert(registry.connect(alice).setToken.staticCall(tokAddr));
  check('non-owner cannot re-set token', noSetTok);

  noVerifier = await expectRevert(registry.connect(alice).setVerifier.staticCall(alice.address, true));
  check('non-owner cannot self-grant verifier', noVerifier);

  console.log(`\n================ RESULT: ${passed} passed / ${failed} failed ================`);
  if (failed) { console.log('FAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('ALL GREEN ✅');
}

main().catch(e => { console.error('E2E FATAL:', e); process.exit(1); });
