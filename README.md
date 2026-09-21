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

**Sylora** records an action description and the hash of its proof photo on BOT Chain. A designated verifier checks the original photo before approving the action. Each approved submission receives **50 SYL** from a fixed reward pool. The token starts with a supply of **1,000,000 SYL** and has no mint function. Demo redemptions burn SYL and record the redemption on-chain.

## Vision

Make community climate action visible, verifiable, and accountable from submission to reward and redemption.

---

## Features

| | Feature | Description |
|:---:|---------|-------------|
| 🌱 | **Log eco-actions** | Submit tree planting, cleanup, recycling, composting, or another green action with a description and photo hash. |
| 🔍 | **Human verification** | A designated verifier compares the original photo with the committed hash before approving or rejecting. |
| 🪙 | **Fixed reward pool** | An approved action receives 50 SYL; all 1,000,000 SYL are allocated to the registry at deployment, with no mint function. |
| 📣 | **Social challenges** | Follow Sylora on X, engage with posts, or share a weekly eco post with a public link and screenshot for review. |
| 🔥 | **Burn on redemption** | Demo redemption burns SYL and records an on-chain event; usable vouchers are not available yet. |

---

## How It Works

<div align="center">

```
Participant ──submit description + photo hash──► BOT Chain
Verifier ──check original photo──► approve or reject
Approved action ──50 SYL from reward pool──► participant
Demo redemption ──burn SYL──► on-chain redemption record
```

</div>

### Gas model (optimized contract)

| Action | Who pays | Design |
|--------|----------|--------|
| Submit action | Participant | Stores a photo hash and short description, not the image itself |
| Verify or reject | Verifier | Approval transfers 50 SYL from the existing pool; rejection pays no reward |
| Read actions and balances | Free | View calls require no transaction |
| Demo redemption | Participant | One registry call burns approved SYL after token allowance is granted |

### 1. Participant

- Browse the landing page and action list without connecting a wallet.
- Connect a wallet on BOT testnet (chain ID `968`) to submit an action.
- Describe the action and select a JPG or PNG proof photo. The app hashes the image locally; keep the original for verification.
- Wait for a verifier's decision. An approved submission receives 50 SYL.
- Use the Challenges tab for Sylora promotion tasks. These use the deployed contract's `other` action type and share its 24-hour cooldown.

### 2. Verifier

- Connect a wallet authorized as a verifier by the organiser.
- Ask the submitter for the original photo outside the app and compare its hash with the recorded proof.
- Review the description and, for a social challenge, its public post or profile link.
- Approve a valid submission or reject it with a reason.

### 3. Organiser

- Deploy and configure the registry and token, then appoint verifier wallets.
- Monitor the reward pool and verification process.
- The current app checks one-time and weekly challenge limits from wallet history; the deployed contract itself only enforces a 24-hour cooldown per action type.

---

## Tech Stack

| Layer | Stack |
|-------|--------|
| **Smart Contract** | Solidity `0.8.20` · `EcoActionRegistry.sol` · `SylToken.sol` |
| **Frontend** | Static HTML, CSS, and JavaScript · `frontend/index.html` · `frontend/app.html` |
| **Wallet / Chain** | ethers.js v6 · MetaMask-compatible wallet · BOT Chain testnet `968` |
| **Development** | Node.js · solc · Anvil-based end-to-end tests |
| **Hosting** | Any static web server |

---

## Live Demo

<div align="center">

**Run Sylora locally**

</div>

From the project root, serve the `frontend` directory:

```bash
python -m http.server 8080 --directory frontend
```

Open [the landing page](http://localhost:8080/) or [the app](http://localhost:8080/app.html). The deployed contracts load in read-only mode before wallet connection; a wallet is required to submit or verify actions.

---

## Smart Contract

| Network | Contract | Address |
|---------|----------|---------|
| **BOT testnet · 968** | EcoActionRegistry | `0xA26FE9756D942A491385B542f6E60e1163C7a6a3` |
| **BOT testnet · 968** | SylToken | `0x9b289f77C099D7D7ed169fdd9c931266C9963dB3` |

The app connects to `https://rpc.bohr.life` for public reads. Contract source and deployment notes are in [`build-week/`](build-week/) and [`DEPLOY_NOTES.md`](build-week/DEPLOY_NOTES.md).

---

## Project Structure

```
sylora/
├── build-week/
│   ├── contracts/
│   │   ├── EcoActionRegistry.sol   # Action registry and rewards
│   │   └── SylToken.sol            # Fixed-supply SYL token
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
