# Sylora: deployment and local run

## Current status

The wallet-free participant flow and shared queue are implemented. The queue-review registry `0x78771952847B4FF95b597f9639aeC8E0D3EF6F47` and token `0x942C734dD3c6a23794e65e16bB78f5A713891537` are deployed and linked on BOT testnet (chain 968). Read-only checks confirmed both contracts point to each other, the registry supports independent daily challenge types, and the registry holds the 1,000,000 SYL reward pool. The shared Node queue must still be running for participants and verifiers to exchange submissions.

## Deploy on BOT testnet (chain ID 968)

1. Run `npm run compile` in `build-week`, then compile `contracts/EcoActionRegistry.sol` and `contracts/SylToken.sol` in Remix with Solidity 0.8.20.
2. Deploy `EcoActionRegistry` with constructor `seedDemo=false`.
3. Deploy `SylToken` with constructor argument equal to the **new registry address** from step 2.
4. On the new registry, call `setToken(newTokenAddress)`.
5. The deployer is already a verifier. Add others with `setVerifier(address, true)`.
6. Check `syl()` on the registry and `registry()` on the token. They must point to each other. Check `poolBalance()` for the 1,000,000 SYL reward pool.

RPC: `https://rpc.bohr.life`.

## Run the shared queue

PowerShell, from `build-week`:

```powershell
npm start
```

Open `http://localhost:8080/app.html`. The verified addresses are built in; `REGISTRY_ADDRESS` and `TOKEN_ADDRESS` can override them. The server serves the frontend, accepts submissions, stores photos and queue metadata in `build-week/data/`, and provides the verifier queue. Keep the server and its data directory running on persistent storage for a public deployment; a static-only host cannot provide the shared queue. Set `PORT`, `RPC_URL`, and `SYLORA_DATA_DIR` when needed.

Participants paste an address and submit without connecting, signing, or confirming anything in a wallet. Verifiers connect an authorized wallet and use Approve/Reject; each decision is one on-chain transaction paid by the verifier. Approval sends 50 SYL directly to the participant address.

The participant's address is not cryptographically proven because no participant signature is requested. The demo photo endpoint is publicly reachable. Add server authentication, private photo storage, and abuse protection before using this with sensitive photos or real rewards.

## Verify locally

```powershell
npm run compile
npm run test:queue
```

`test:queue` starts a local Ganache chain and the queue server, then checks submission, photo upload, approve/reject, reward transfer, replay protection, and zero participant gas. The previous `test:gasless` and `test:e2e` scripts remain for legacy contract paths.
