# Project Requirement Document
## SYLORA — Eco-Action Reward DApp
**Tagline:** *"Where environmental action becomes verifiable value"*
### Build Week Hackathon Vol.2 — Girls Meet Tech

---

**Author:** Erina (ocean)
**Date:** 9 September 2026 (v0.2 — post competitor gap analysis)
**Status:** Draft v0.2
**Hackathon submission deadline:** 23 September 2026, 11:59 PM (GMT+7)
**Build window:** 18–22 September 2026 (5 days)

---

## 1. Background

Build Week Hackathon Vol.2 dari Girls Meet Tech menantang peserta membangun **DApp (Decentralized Application)** di **BOT Chain**, dengan deployment ke mainnet, custom domain, dan live demo. Format submission mengharuskan smart contract Solidity + frontend HTML yang connect ke MetaMask, dengan chain testnet untuk development dan mainnet untuk submission final.

SYLORA terinspirasi dari project Lumora (Indra Mahesa, 2026) yang mengeksplorasi reward untuk eco-action di Internet Computer. Improvement utama: porting konsep ke BOT Chain (EVM-compatible, Chain ID 677), menyederhanakan menjadi MVP 2 fitur inti, dan menambahkan support untuk organizer verification on-chain sehingga reward benar-benar ter-desentralisasi.

---

## 1a. Competitor & Gap Analysis (riset 9 Sept 2026)

**Kompetitor yang dianalisis:**

| Project | Model | Pelajaran |
|---|---|---|
| DeCleanup Network (Base+Celo) | Clean-to-earn | Staked verifier (100 token) + slashing; GPS+timestamp; Hypercerts tiap 10 cleanup |
| Green Credit (Devpost/Moonbeam) | Submit+verify+reward (paling mirip SYLORA) | Sink ekonomi: stake USDC earn GCT; roadmap oracle & Web-of-Trust |
| EcoQuest (Devpost) | Gamified eco-action | Verifikasi AI vision (confidence score, deteksi foto stock/duplikat), streak multiplier |
| Treegens | Proof-of-Tree mangrove | Token $MGRO hanya lahir dari planting terverifikasi (AI + DAO), bukti lapangan ber-GPS |
| VeChain x 4ocean (Cleanify) | Clean-to-Earn korporat | Reward ganda: token + fisik (gelang plastik daur ulang) |
| Green Goods | Impact-to-funding | Work verified → Hypercerts yang dibeli funder CSR |
| Tanbii (startup $3M pre-seed) | Climate game | Proof-of-Green: AI verifikasi behavior, 25k early users |
| Plastic Bank | SaaS fintech sosial | AI fraud detection via pattern recognition |
| Toucan/KlimaDAO (studi kegagalan) | Tokenisasi carbon credit | Tokenisasi tanpa quality control → pasar jadi tempat buang kredit jelek ("zombie credits"). Lesson: quality gate WAJIB di desain awal |

**Gap SYLORA vs pasar → 4 improvement yang masuk MVP (lihat §5 untuk spec):**

1. **Proof bisa diganti setelah submit** (semua kompetitor menyimpan GPS/timestamp/hash) → fix: simpan `keccak256(imageBytes)` on-chain, bukan URL.
2. **Verifikasi 1 organizer = bottleneck** (pesaing sudah pakai AI/staking) → MVP tetap human-verified, tapi hash proof membuat verifikasi auditable. AI vision = roadmap.
3. **Tokenomics tanpa sink** (kesalahan yang sama dengan Toucan: mint bebas → inflasi) → fix: reward pool dari sponsor + burn-on-redeem. $SYL hanya keluar dari pool sponsor, dan dibakar saat redeem voucher.
4. **Zero anti-sybil** → fix: cooldown per jenis aksi + max pending per user (on-chain mapping).

**Angle lokal yang belum dipakai pesaing Indonesia:** aplikasi bank sampah ada banyak, tapi nilainya sering turun & tidak transparan (paper jurnal: "Depresiasi Nilai Poin DTBM"). Pitch: *SYLORA = reward lingkungan dengan buku kas publik — tiap $SYL keluar dari smart contract tercatat publik, tidak bisa "dicetak diam-diam" seperti poin bank sampah.*

---

## 2. Goals & Non-Goals

### Goals (in scope)
- Smart contract ERC-20 untuk token $SYL (reward)
- Smart contract Registry untuk log eco-action (on-chain proof)
- Frontend 1 halaman HTML yang connect MetaMask + panggil contract
- Deploy ke BOT Chain **testnet** (development) dan **mainnet** (submission)
- Live di custom domain ($1 reimbursement dari hackathon)
- Demo flow: submit → verify → mint reward, end-to-end working

### Non-Goals (out of scope untuk MVP)
- NFT badge (rencana next steps)
- AI vision verification (roadmap — lihat §4a gap analysis)
- Staked verifier + slashing (roadmap — cite DeCleanup Network)
- Integrasi bank sampah/TPSS asli (roadmap)
- Leaderboard on-chain
- Mobile app (web responsif sudah cukup)
- Multi-organizer governance
- Token withdrawal ke fiat

---

## 3. Tech Stack

### Layer
| | Tool/Service | Justification |
|---|---|---|
| Smart contract | Solidity `^0.8.20` | Standar EVM, supported Remix |
| IDE | Remix IDE (remix.ethereum.org) | Sesuai Phase 4 guidebook, no setup |
| Wallet | MetaMask | Wajib (guidebook Step 1) |
| Testnet | BOT Chain Testnet (Bohr) | Chain ID 968, RPC `https://rpc.bohr.life` |
| Mainnet | BOT Chain Mainnet | Chain ID 677, RPC `https://rpc.botchain.ai` |
| Faucet | https://faucet.botchain.ai/basic | 10 BOT/24h untuk testnet |
| Frontend | 1 file HTML + JS (vanilla atau Ethers.js) | Guidebook: "one HTML file is enough" |
| Library | Ethers.js v6 (CDN) | Standar interaksi MetaMask → contract |
| Hosting | GitHub Pages | Free, sesuai guidebook |
| Domain | Custom domain (~$1) | Reimbursement dari GMT |
| Mainnet gas | BOT (real token, dari organizer) | Guidebook Step 12 |

### Standard EIP yang dipakai
- **ERC-20** untuk token $SYL
- **Custom struct + mapping** untuk registry (tidak perlu ERC-721 untuk MVP)

---

## 4. BOT Chain Ecosystem — Research Notes

### Identitas jaringan
- **Nama:** BOT Chain
- **Tipe:** Layer 1 EVM-compatible, fokus AI agents & DePIN
- **Konsensus:** Hybrid SPoA (physical compute-backed + staking)
- **Fee:** ~$0.06/tx (early 2025) — rendah
- **Finality:** < 1 detik (sub-detik)
- **Native token:** BOT (total supply 150 jt)

### Testnet (Bohr)
- Chain ID: **968**
- RPC: `https://rpc.bohr.life`
- Explorer: `https://scan.bohr.life/`
- Faucet: `https://faucet.botchain.ai/basic` (10 BOT/24h per address)
- Wallet support: MetaMask, BO Wallet

### Mainnet
- Chain ID: **677**
- RPC: `https://rpc.botchain.ai`
- Explorer: `https://scan.botchain.ai/`
- Gas payment: BOT (real)
- Mainnet BOT source: DEX (https://dex.botchain.ai) atau dari organizer hackathon

### Alat development
- **Remix IDE** — primary (sesuai guidebook)
- **Hardhat / Foundry** — optional, kalau butuh testing lokal
- **Ethers.js / Web3.js** — interaksi frontend
- **MetaMask** — wallet wajib
- **TheGraph, Covalent** — indexing (tidak dipakai MVP)

### Catatan risiko
- Faucet rate-limit: 10 BOT/24h. Cuma cukup untuk beberapa deploy testnet. Hemat testnet calls.
- Mainnet butuh BOT real → contact organizer (Step 12 guidebook)
- Remix Injected Provider bisa lambat/timeout. Fallback: Remix VM (local) untuk testing murni, deploy ke testnet di akhir.

---

## 5. Feature Requirements

### 5.1 Smart Contract: $SYL Token (ERC-20)

| Field | Spec |
|---|---|
| **Name** | SYLORA Token |
| **Symbol** | SYL |
| **Decimals** | 18 |
| **Total supply** | 1,000,000 SYL (capped, mint ke reward pool saat deploy) |
| **Reward pool** | Full supply dikirim ke `EcoActionRegistry` (pool contract). Reward HANYA keluar dari pool ini — tidak ada mint bebas (anti-inflasi, lesson Toucan/KlimaDAO) |
| **Burn** | Burn-on-redeem: user burn SYL → dapat voucher mock. Supply turun seiring redeem |

**Functions:**
```solidity
function mint(address to, uint256 amount) external onlyRegistry
function burn(uint256 amount) external
function balanceOf(address) view returns (uint256)
```

### 5.2 Smart Contract: EcoActionRegistry

**Data structure per action:**
- `id` (bytes32, hash dari action payload)
- `submitter` (address user)
- `actionType` (string: "tree_planting", "beach_cleanup", "recycle", "compost", "other")
- `description` (string, max 280 char)
- `imageHash` (bytes32 — **keccak256 dari bytes foto proof**, dihitung client-side sebelum upload. BUKAN URL: foto tidak bisa diganti setelah submit. URL/IPFS tetap disimpan off-chain sebagai metadata opsional)
- `submittedAt` (uint256 timestamp)
- `status` (enum: Pending=0, Verified=1, Rejected=2)
- `verifier` (address organizer)
- `rewardAmount` (uint256, 0 sampai Verified)
- `streak` (uint16 — counter berturut-turut submitter, on-chain)

**Functions:**
```solidity
function submitAction(string actionType, string description, bytes32 imageHash) external returns (bytes32)
    // require(block.timestamp >= lastSubmit[msg.sender][actionType] + COOLDOWN)  // anti-spam, default 24h per jenis aksi
    // require(pendingCount[msg.sender] < MAX_PENDING)                            // default 3
function verifyAction(bytes32 actionId) external onlyVerifier   // transfer SYL dari pool + update streak
function rejectAction(bytes32 actionId, string reason) external onlyVerifier
function redeemVoucher(uint256 ecoAmount) external             // burn SYL -> voucher event (mock)
function getAction(bytes32 actionId) view returns (Action memory)
function getActionsByUser(address user) view returns (bytes32[])
```

**Roles:**
- `owner` deployer (punya hak tambah/hapus verifier)
- `verifier` organizer yang ditunjuk owner (punya hak verify/reject)
- `submitter` siapa saja yang connect wallet

### 5.3 Reward Logic (sink-based, anti-inflasi)
- Reward flat: **50 SYL per verified action**, TAPI hanya dari pool SYL yang di-deposit ke Registry
- `verifyAction()` memanggil `eco.transfer(submitter, 50)` dari pool — pool habis = reward berhenti (solvent by design)
- Sponsor/orang bisa `topUpPool()` (onlyOwner) — di demo: organizer top-up 100k SYL
- `redeemVoucher()`: user burn SYL → contract emit `VoucherRedeemed` → frontend tampilkan voucher mock (misal "1 pohon ditanam atas nama kamu"). Ini sink yang bikin $SYL punya utility nyata di demo

### 5.4 Frontend (1 HTML file)

**Halaman tunggal, sections:**
1. **Header** — Logo SYLORA + tagline + tombol "Connect MetaMask"
2. **Status bar** — Network (testnet/mainnet), wallet address (truncated), $BOT balance, $SYL balance
3. **Submit form** (kolom: action type dropdown, description, proof URL) → "Submit"
4. **My actions** — list actions by connected wallet, dengan status
5. **Verifier panel** (hanya tampil jika address = verifier) — list pending actions + tombol Verify/Reject
6. **Leaderboard** (read-only, top 10 by SYL balance) — bonus, optional

**Behavior:**
- Detect MetaMask via `window.ethereum`
- Switch/add network ke BOT Chain (testnet dulu, mainnet toggle untuk demo final)
- Display notif untuk setiap tx (hash + explorer link)
- Error handling: user reject, wrong network, insufficient gas, contract not deployed

**Mock data untuk submission deadline:**
- Pre-populate 3 sample verified actions (deploy dengan constructor argumen list ID)
- Tujuannya: saat juri buka URL, gak lihat empty state

---

## 6. Submission Deliverables (wajib, sesuai guidebook)

| # | Item | Format | Path/Source |
|---|---|---|---|
| 1 | **Contract address** di mainnet | `0xABC123...` | dari step Deploy Mainnet |
| 2 | **Live URL** frontend | `https://<domain>.<tld>/` | GitHub Pages + custom domain |
| 3 | **Source code smart contract** | `.sol` file | `contracts/EcoActionRegistry.sol`, `contracts/SylToken.sol` |
| 4 | **README** | `README.md` di repo GitHub | explain setup, deploy, demo flow |

**Plus opsional (tidak wajib tapi membantu):**
- **Demo video** 2-3 menit (screen record: connect wallet → submit → verify → cek balance)
- **Pitch deck** (pakai struktur Lumora 11 slide)
- **Screenshot** dari explorer BOTScan mainnet showing verified contract

---

## 7. Project Structure

```
sylora/
├── README.md
├── contracts/
│   ├── SylToken.sol          # ERC-20 token
│   └── EcoActionRegistry.sol # Registry + verifier logic
├── frontend/
│   └── index.html             # 1 file, Ethers.js dari CDN
├── docs/
│   ├── pitch-deck.pdf         # 11 slides, format Lumora
│   └── demo-video.mp4         # 2-3 menit
└── .env.example               # CONTRACT_ADDRESS=0x...
```

---

## 8. Build Schedule (18–22 September 2026)

> Catatan: GIK 2026 submission deadline 15 Sept, jadi tanggal 18 lo udah bebas.

| Hari | Track | Task | Output |
|---|---|---|---|
| **Kam 18/9** | Pagi | Setup MetaMask + BOT testnet + faucet claim | Wallet funded |
| | Sore | Tulis `SylToken.sol`, compile di Remix, deploy testnet | Token on testnet |
| | Malam | Tulis `EcoActionRegistry.sol` dasar, deploy testnet | Registry on testnet |
| **Jum 19/9** | Full | Frontend: connect MetaMask + form submit + list my actions | HTML bisa submit |
| **Sab 20/9** | Full | Frontend: verifier panel + reward mint + balance display | Flow end-to-end jalan |
| **Min 21/9** | Pagi | E2E test, fix bugs, mobile responsive check | Stabil |
| | Sore | Beli domain (~$1), setup GitHub Pages + custom domain | Live URL |
| **Sen 22/9** | Pagi | Deploy contract ke **mainnet** (pakai BOT dari organizer) | Mainnet contract address |
| | Sore | Update frontend `.env` ke mainnet address, redeploy GitHub Pages | Frontend on mainnet |
| | Malam | Record demo video, finalize README, buat pitch deck | Semua deliverable ready |
| **Sel 23/9** | Siang | Submit form sebelum 11:59 PM GMT+7 | Done |

**Buffer:** 1 hari (Sel 23/9 siang). Kalau ada setback, masih ada 6 jam sebelum deadline.

---

## 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Faucet rate-limit (10 BOT/24h) | Medium | Low | Claim 2 wallet berbeda kalau perlu |
| Mainnet gas/insufficient BOT | Medium | High | Contact organizer lebih awal (Step 12) |
| Remix Injected Provider timeout | High | Medium | Fallback ke Remix VM untuk compile, deploy manual via MetaMask |
| MetaMask user reject signature | Low | Low | UX: tombol jelas, error message informatif |
| Domain DNS propagation telat | Low | Medium | Beli domain **Sab 20** bukan Min 21, biar ada 24h |
| 5 hari gak cukup | Medium | High | Drop leaderboard (sudah non-goal), keep 2 fitur inti |
| Burnout karena abis GIK | High | High | Hari 18 cuma setup + token contract ringan, jangan overcommit |

---

## 10. Success Criteria

**Minimum untuk dianggap "working":**
- [ ] Smart contract deployed di **mainnet** (address valid di scan.botchain.ai)
- [ ] Frontend live di **custom domain** (bukan github.io)
- [ ] User bisa **submit action** → status visible di UI
- [ ] Verifier (organizer) bisa **verify** → $SYL masuk ke submitter
- [ ] Submit 4 deliverables sebelum **23 Sept 23:59 GMT+7**

**Bonus (tidak wajib, tapi meningkatkan peluang menang):**
- [ ] Demo video yang narasiin flow
- [ ] Pitch deck 11 slide (format Lumora)
- [ ] 3 sample verified actions pre-populated (UI gak kosong)
- [ ] Mobile responsive (cek di MetaMask mobile browser)

---

## 11. Next Steps (post-hackathon, roadmap)

- **Tahap 2 — AI verification layer**: confidence score via vision LLM (pola EcoQuest/Plastic Bank), AI sebagai filter pertama sebelum human verifier. Verifikasi tetap human-final.
- **Tahap 3 — Staked verifiers + slashing** (pola DeCleanup Network): verifier stake $SYL, verifikasi palsu = stake dipotong. Menghapus bottleneck organizer tunggal.
- **Tahap 4 — IPFS + bukti GPS/timestamp** untuk proof lengkap (sekarang hanya hash on-chain)
- **Tahap 5 — Integrasi bank sampah/TPSS Gresik** — pilot nyata: poin bank sampah ↔ $SYL dengan kurs ter-burn, plus angle transparansi buku kas publik (paper: Depresiasi Nilai Poin DTBM)
- **Tahap 6** — Leaderboard on-chain, badge NFT (ERC-721), multi-verifier governance (DAO-style)

---

## References

- [GMT Build Week Hackathon Vol.2 Guidebook](https://www.girlmeetstech.org/guidebook-build-week-hackathon-vol2)
- [BOT Chain Developer Docs](https://dev-docs.botchain.ai/docs/intro/)
- [BOT Chain Testnet Faucet](https://faucet.botchain.ai/basic)
- [BOT Chain Testnet Explorer (Bohr)](https://scan.bohr.life/)
- [BOT Chain Mainnet Explorer](https://scan.botchain.ai/)
- [Lumora Pitch Deck](https://...) — referensi struktur, Indra Mahesa, 2026
