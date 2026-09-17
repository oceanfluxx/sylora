# SYLORA 🌱

**Eco-action reward DApp with a fixed public ledger** — aksi lingkungan tercatat, reward punya batas, dan lifecycle poin dapat diaudit siapa pun.

> Built for **GMT Build Week Vol.2** — target: BOT Chain (testnet chain ID 968 / mainnet Bohr 677).

## ✨ Kenapa SYLORA beda

Platform seperti ESG-in, Sirkula, dan aplikasi bank sampah sudah membuktikan bahwa orang mau melakukan aksi hijau kalau ada reward. SYLORA mengambil pertanyaan berikutnya: bagaimana memastikan reward itu tidak bisa dicetak seenaknya dan riwayatnya tidak bisa diubah diam-diam?

| Poin lemah reward lingkungan umum | Solusi SYLORA |
|---|---|
| Poin bisa diubah tanpa catatan publik | **Supply hard-cap 1.000.000 $SYL** — tidak ada fungsi `mint()` sama sekali di contract |
| Bukti foto bisa diganti setelah dikirim | `imageHash` (keccak256) di-commit on-chain **sebelum** upload — bukti terkunci saat submit |
| Poin cuma angka tanpa lifecycle | $SYL **dibakar** saat tukar voucher → supply menyusut, ada real utility |
| Reward keluar tanpa batas yang jelas | Reward hanya keluar dari pool — **solvent by design**, pool balance = reward unclaimed |

## 🧱 Contracts

- **`SylToken.sol`** — ERC-20 minimalis, supply 1jt *minted once* langsung ke pool (EcoActionRegistry), punya `burn`/`burnFrom` untuk sink. `registry` address `immutable`.
- **`EcoActionRegistry.sol`** — logbook on-chain aksi lingkungan: submit (dengan hash foto), verify oleh organizer, reward 50 SYL, streak, tukar voucher dengan burn.

## 🧪 Test

```bash
# 36/36 E2E tests, dijalankan di anvil (local EVM)
cd build-week
node compile.js                # solc 0.8.20
anvil --chain-id 968 --port 8545
node test-e2e.js               # → ALL GREEN ✅
```

Cakupan test: token invariants, no-mint enforcement, cooldown 24 jam per jenis aksi, max 3 pending, verify→reward→streak, reject flow, redeem burn sink, pool arithmetic, input guards, admin guards, anti-photo-swap.

## 🚀 Deploy

Urutan deploy **WAJIB**:
1. `EcoActionRegistry(true)` — seed 3 demo action untuk display
2. `SylToken(registryAddress)` — full supply masuk pool
3. `registry.setToken(tokenAddress)`

Detail lengkap: [`build-week/DEPLOY_NOTES.md`](build-week/DEPLOY_NOTES.md)

## 📋 Status

- [x] Smart contracts (Solidity ^0.8.20) — compile & 36/36 E2E green
- [ ] Deploy ke BOT Chain testnet (butuh faucet)
- [x] Landing kawaii-coffee (DESIGN.md token system, ID copy) + DApp app.html (MetaMask, ethers v6, demo mode)

## 📄 PRD

Lihat [`SYLORA_PRD.md`](SYLORA_PRD.md) — gap analysis, tokenomics, MVP scope.

---
*Lesson learned dari proyek eco-token sebelumnya (Toucan/KlimaDAO zombie credits): token yang bisa di-mint bebas = trust-killer. SYLORA justru sebaliknya — supply terkunci selamanya, human verification untuk MVP, dan burn-on-redeem. AI verification tetap roadmap.*