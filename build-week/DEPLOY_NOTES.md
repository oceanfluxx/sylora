# SYLORA — DEPLOY & TEST CHEAT SHEET (GMT Build Week, submit 23 Sept)

## Status: SIAP DEPLOY ✅
- [x] 2 smart contract (SylToken + EcoActionRegistry) — compile OK, bytecode di `build/`
- [x] Test E2E 36/36 lulus di anvil (lokal in-memory EVM, chain id 968)
- [x] 1 bug serius udah di-fix: redeem voucher sekarang **pull-and-burn** (1 transaksi),
      pool balance nggak pernah kebolong
- [ ] Deploy ke BOT testnet (chain id 968, RPC: https://rpc.botchain.ai) — BUTUH FAUCET
- [ ] Frontend (belum dibuat — luar scope smart contract)

## Cara test lokal (reproduce 36/36)
```bash
cd ~/Documents/SYLORA/build-week
node compile.js                      # refresh build/ ABI + bytecode
# start anvil:
~/.foundry/bin/anvil --chain-id 968 --gas-price 20000000000 --port 8545
node test-e2e.js                     # harusnya ALL GREEN
```
Anvil jalan di port 8545 (instant-mine, deterministic). Test pake 3 wallet anvil default
(derive dari mnemonic `test test ... junk` — lihat test-e2e.js).

## Cara deploy (kalau udah dapat faucet testnet)
1. Buka Remix (remix.ethereum.org) → import file `contracts/*.sol` → compile 0.8.20
2. Deploy order **WAJIB**:
   a. `EcoActionRegistry` dengan constructor arg `true` (seed demo buat juri)
   b. `SylToken` dengan constructor arg = **address registry** dari langkah a
   c. From registry: `setToken(addressToken)`
3. Wallet deployer = organiser/owner. Tambah verifier via `setVerifier(addr, true)`.
4. Testnet: https://rpc.botchain.ai (chain id 968) · Mainnet Bohr: https://rpc.bohr.life (677)
   Gas price testnet terakhir cek: ~20 gwei.

## Temuan penting dari self-audit
1. **Bug fix #1 (sudah beres):** redeem voucher dulu transfer token ke registry lalu
   burn dari registry → registry jadi keeper tanpa izin (risk: token nyangkut /
   pool balance ambiguous). Sekarang: `burnFrom` dari user, pool = balance registry
   murni berisi reward.
2. **No mint ever:** token supply hard-cap 1jt, SEMUA ke pool di deploy. Gak ada
   `mint()` sama sekali di ABI — udah di-test. Ini diferensiator vs poin-poin
   bank sampah yang bisa di-print diam-diam (pelajaran Toucan/KlimaDAO zombie credits).
3. **Anti-photo-swap:** `imageHash = keccak256(bytes foto)` dihitung CLIENT sebelum
   upload → bukti terkunci saat submit. Udah di-test on-chain.
4. **Anti-spam:** cooldown 24 jam per (user, jenis aksi), max 3 pending per user.
5. **Pool solvent by design:** reward cuma keluar dari pool, pool = 1jt hard-cap,
   verify cek balance pool dulu (error `PoolEmpty`). Udah di-assert di test.

## Asumsi yang perlu diklarifikasi sama user nanti (low priority)
- Streak sekarang reset otomatis > 72 jam; demo seed di constructor jalan tanpa token
  (rewardAmount=0, display-only) — honest, bukan fake data.
- `topUpPool` butuh approve dulu; plain transfer $SYL ke registry juga valid.
