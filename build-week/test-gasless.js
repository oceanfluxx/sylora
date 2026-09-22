const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ganache = require('ganache');
const { ethers } = require('ethers');

const mnemonic = 'test test test test test test test test test test test junk';
const server = ganache.server({ chain: { chainId: 968 }, wallet: { mnemonic }, logging: { quiet: true } });
const artifact = name => ({
  abi: JSON.parse(fs.readFileSync(path.join(__dirname, 'build', `${name}.abi.json`), 'utf8')),
  bytecode: fs.readFileSync(path.join(__dirname, 'build', `${name}.bin`), 'utf8').trim()
});
const types = { SubmitAction: [
  { name: 'submitter', type: 'address' }, { name: 'actionType', type: 'string' },
  { name: 'description', type: 'string' }, { name: 'imageHash', type: 'bytes32' },
  { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }
] };

async function reverts(promise, label) {
  await assert.rejects(promise, undefined, label);
}

async function main() {
  await server.listen(0, '127.0.0.1');
  try {
    const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${server.address().port}`);
    const wallet = i => ethers.HDNodeWallet.fromPhrase(mnemonic, null, `m/44'/60'/0'/0/${i}`).connect(provider);
    const owner = new ethers.NonceManager(wallet(0)), participant = wallet(1), verifier = wallet(2), stranger = wallet(3);
    const registryArtifact = artifact('EcoActionRegistry');
    const tokenArtifact = artifact('SylToken');
    const registry = await new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, owner).deploy(false);
    await registry.waitForDeployment();
    const token = await new ethers.ContractFactory(tokenArtifact.abi, tokenArtifact.bytecode, owner).deploy(await registry.getAddress());
    await token.waitForDeployment();
    await (await registry.setToken(await token.getAddress())).wait();
    await (await registry.setVerifier(verifier.address, true)).wait();

    const domain = { name: 'SYLORA', version: '1', chainId: 968, verifyingContract: await registry.getAddress() };
    const message = {
      submitter: participant.address, actionType: 'tree_planting', description: 'Planted one tree',
      imageHash: ethers.id('photo'), nonce: 12345n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };
    const signature = await participant.signTypedData(domain, types, message);
    const relay = (who, value = message, sig = signature) => registry.connect(who).submitActionFor.staticCall(
      value.submitter, value.actionType, value.description, value.imageHash, value.nonce, value.deadline, sig
    );

    await reverts(relay(stranger), 'non-verifier must not relay');
    await reverts(relay(verifier, { ...message, description: 'Changed description' }), 'signed content must not change');
    await reverts(relay(verifier, message, await stranger.signTypedData(domain, types, message)), 'wrong signer must fail');
    await reverts(relay(verifier, { ...message, deadline: 1n }), 'expired request must fail');
    const wrongDomain = { ...domain, chainId: 969 };
    await reverts(relay(verifier, message, await participant.signTypedData(wrongDomain, types, message)), 'wrong chain must fail');
    await reverts(relay(verifier, message, await participant.signTypedData({ ...domain, verifyingContract: stranger.address }, types, message)), 'wrong registry must fail');

    const participantGasBefore = await provider.getBalance(participant.address);
    const verifierGasBefore = await provider.getBalance(verifier.address);
    const tx = await registry.connect(verifier).submitActionFor(
      message.submitter, message.actionType, message.description, message.imageHash, message.nonce, message.deadline, signature
    );
    await tx.wait();
    const id = (await registry.getActionsByUser(participant.address))[0];
    assert.equal((await registry.actions(id)).submitter, participant.address);
    assert.equal(await registry.pendingCount(participant.address), 1n);
    assert.equal(await registry.usedNonces(participant.address, message.nonce), true);
    assert.equal(await provider.getBalance(participant.address), participantGasBefore, 'participant pays no gas');
    assert.ok((await provider.getBalance(verifier.address)) < verifierGasBefore, 'verifier pays gas');
    await reverts(relay(verifier), 'signature replay must fail');
    const secondMessage = { ...message, nonce: 12346n };
    await reverts(relay(verifier, secondMessage, await participant.signTypedData(domain, types, secondMessage)), 'signed request obeys cooldown');

    await (await registry.connect(verifier).verifyAction(id)).wait();
    assert.equal(await token.balanceOf(participant.address), 50n * 10n ** 18n);
    console.log('Gasless signature, verifier payment, replay protection, and reward checks passed');
  } finally {
    await server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
