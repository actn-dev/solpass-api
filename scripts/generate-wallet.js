const { Keypair } = require('@solana/web3.js');

console.log('\n🔑 Generating Solana Keypair for Server Wallet...\n');

const keypair = Keypair.generate();
const publicKey = keypair.publicKey.toBase58();
const secretKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');

console.log('✅ Keypair Generated Successfully!\n');
console.log('Public Key:', publicKey);
console.log('\nSecret Key (base64):');
console.log(secretKeyBase64);
console.log('\n📝 Update your .env file with:');
console.log(`SERVER_WALLET_SECRET_KEY=${secretKeyBase64}`);
console.log('\n💰 Fund this wallet on devnet:');
console.log(`https://faucet.solana.com/?address=${publicKey}`);
console.log('\nOr use CLI:');
console.log(`solana airdrop 2 ${publicKey} --url devnet\n`);
