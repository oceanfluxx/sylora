<div align="center">

<img src="frontend/assets/syl-logo.png" alt="Sylora logo" width="120" />

# Sylora

**Eco-action rewards on BOT Chain**

Record real environmental actions, verify their proof, and reward approved contributions with a fixed-supply SYL token.

<br />

[![BOT Chain Testnet](https://img.shields.io/badge/BOT%20Chain-Testnet%20968-3E7A52?style=for-the-badge)](https://scan.bohr.life/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](frontend/app.html)
[![ethers.js](https://img.shields.io/badge/ethers.js-v6-2535A0?style=for-the-badge)](frontend/vendor/ethers.umd.min.js)

<br />

![Sylora landing and app preview](frontend/preview.png)

<br />

[Live Demo](#live-demo) · [Features](#features) · [How It Works](#how-it-works) · [Smart Contract](#smart-contract)

</div>

---

## Problem

Environmental reward apps need a way to show that an action was reviewed and that rewards cannot be issued without limit. Photos can be swapped after submission, private point balances are hard to audit, and redemption often leaves no visible record of what happened to the points.

## Solution

**Sylora** sends an action description and photo to a verifier queue. The verifier approves or rejects the submission; the decision and photo hash are recorded on BOT Chain. Each approved submission receives **50 SYL** from a fixed reward pool. The token starts with a supply of **1,000,000 SYL** and has no mint function. Demo redemptions burn SYL and record the redemption on-chain.

## Vision

Make community climate action visible, verifiable, and accountable from submission to reward and redemption.

---

## Features

| | Feature | Description |
|:---:|---------|-------------|
| 🌱 | **Log eco-actions** | Submit tree planting, cleanup, recycling, composting, or another green action with a description and photo. |
| 🔍 | **Human verification** | A designated verifier sees the submitted photo and approves or rejects it. |
| 🪙 | **Fixed reward pool** | An approved action receives 50 SYL; all 1,000,000 SYL are allocated to the registry at deployment, with no mint function. |
| 📣 | **Social challenges** | Follow Sylora on X, engage with posts, or share a weekly eco post with a public link and screenshot for review. |
| 🔥 | **Burn on redemption** | Demo redemption burns SYL and records an on-chain event; usable vouchers are not available yet. |

---

## How It Works

<div align="center">

```
Participant ──submit address, action + photo──► shared queue
Verifier ──approve or reject (one transaction)──► BOT Chain
Approved action ──50 SYL from reward pool──► participant
Demo redemption ──burn SYL──► on-chain redemption record
```

</div>

### Gas model for the shared queue

| Action | Who pays | Design |
|--------|----------|--------|
| Submit action or challenge | Participant | No wallet connection, confirmation, signature, transaction, or gas fee |
| Approve or reject | Verifier | One transaction; approval transfers 50 SYL from the reward pool |
| Read actions and balances | Free | View calls require no transaction |
| Demo redemption | Participant | One registry call burns approved SYL after token allowance is granted |

### 1. Participant

- Browse the landing page and action list without connecting a wallet.
- Paste a BOT testnet wallet address to receive SYL. This does not connect or prompt the wallet.
- Describe the action and select a JPG or PNG photo (maximum 5 MB). Submit it directly in the app.
- Wait for the verifier to approve or reject the queued submission.
- Approval transfers 50 SYL directly from the reward pool to the participant's wallet. There is no separate withdrawal transaction. Use **Show SYL in wallet** in the app, or import the token contract address manually in the wallet if needed.
- Use the Challenges tab for Sylora promotion tasks. These use the deployed contract's `other` action type and share its 24-hour cooldown.

### 2. Verifier

- Connect a wallet authorized as a verifier by the organiser.
- See queued submissions, including the photo and description, in the verifier desk.
- Click **Approve** or **Reject**. This is one transaction paid by the verifier wallet.

The shared queue requires a running Node server. Because the participant does not sign, the verifier is responsible for deciding whether the submitted wallet address and evidence are credible. The demo queue currently exposes uploaded photos to anyone who knows the photo URL; add authentication and private storage before using real personal photos in production.

Run `npm run compile` and `npm run test:queue` from `build-week` to verify the queue and review flow locally.

### 3. Organiser

- Deploy and configure the registry and token, then appoint verifier wallets.
- The queue review contract change is compiled and tested locally but **has not been deployed to BOT testnet**. The previous registry `0x58486a357a3bf5bd77dea5f21981f3Be86e58E5B` and token `0xeCF75581e51AA07d40Ff13a689B6E2b0FB386fE6` cannot support this one-click review. Deploy a new registry and a new token tied to it, then configure the server with their addresses. Existing balances do not migrate automatically.
- Monitor the reward pool and verification process.
- The current app checks one-time and weekly challenge limits from wallet history; the deployed contract itself only enforces a 24-hour cooldown per action type.

---

## Tech Stack

| Layer | Stack |
|-------|--------|
| **Smart Contract** | Solidity `0.8.20` · `EcoActionRegistry.sol` · `SylToken.sol` |
| **Frontend and queue** | HTML, CSS, and JavaScript · Node.js HTTP server · file-backed queue |
| **Wallet / Chain** | ethers.js v6 · MetaMask-compatible wallet · BOT Chain testnet `968` |
| **Development** | Node.js · solc · Anvil-based end-to-end tests |
| **Hosting** | Node.js server with persistent disk for queue and photos |

---

## Live Demo

<div align="center">

**Run Sylora locally**

</div>

After deploying the new registry and token, run from `build-week`:

```powershell
$env:REGISTRY_ADDRESS="0xNEW_REGISTRY"
$env:TOKEN_ADDRESS="0xNEW_TOKEN"
npm start
```

Open [the app](http://localhost:8080/app.html). The server addresses are loaded automatically. A wallet is needed only for verifier review, balance display, token import, or redemption.

---

## Smart Contract

| Network | Contract | Address |
|---------|----------|---------|
| **BOT testnet · 968** | Queue-review EcoActionRegistry | Awaiting deployment |
| **BOT testnet · 968** | SylToken tied to new registry | Awaiting deployment |

The app connects to `https://rpc.bohr.life` for public reads. Contract source and deployment notes are in [`build-week/`](build-week/) and [`DEPLOY_NOTES.md`](build-week/DEPLOY_NOTES.md).

---

## Project Structure

```
sylora/
├── build-week/
│   ├── contracts/
│   │   ├── EcoActionRegistry.sol   # Action registry and rewards
│   │   └── SylToken.sol            # Fixed-supply SYL token
│   ├── server.js                   # Shared queue and frontend server
│   ├── test-queue.js               # Queue and contract integration test
│   ├── test-e2e.js                 # Contract end-to-end tests
│   └── DEPLOY_NOTES.md             # Deployment and test notes
├── frontend/
│   ├── assets/                     # Logo and mascot images
│   ├── vendor/                     # Bundled ethers.js
│   ├── index.html                  # Landing page
│   └── app.html                    # Wallet app
├── SYLORA_PRD.md
└── README.md
```

---

<div align="center">

**Sylora** — real climate actions, verifiable rewards on BOT Chain<br />
Made for GMT Build Week Vol. 2

</div>
