// Compile SYLORA contracts with solc 0.8.20 (PRD §3: Solidity ^0.8.20)
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractsDir = path.join(__dirname, 'contracts');
const outDir = path.join(__dirname, 'build');
fs.mkdirSync(outDir, { recursive: true });

const sources = {};
for (const f of fs.readdirSync(contractsDir)) {
  if (f.endsWith('.sol')) {
    sources[f] = { content: fs.readFileSync(path.join(contractsDir, f), 'utf8') };
  }
}

const input = {
  language: 'Solidity',
  sources,
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

let ok = true;
for (const file in output.errors || {}) {
  const e = output.errors[file];
  if (e.severity === 'error') { ok = false; console.error('ERROR:', e.formattedMessage); }
  else console.warn('WARN :', e.formattedMessage.split('\n')[0]);
}

if (!ok) { process.exit(1); }

for (const file in output.contracts) {
  for (const name in output.contracts[file]) {
    const c = output.contracts[file][name];
    const base = path.join(outDir, name);
    fs.writeFileSync(base + '.abi.json', JSON.stringify(c.abi, null, 2));
    fs.writeFileSync(base + '.bin', '0x' + c.evm.bytecode.object);
    console.log(`${name}: ${(c.evm.bytecode.object.length / 2 / 1024).toFixed(2)} KB bytecode, ABI -> ${name}.abi.json`);
  }
}
console.log('COMPILE OK');
