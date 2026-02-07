import { Keypair } from '@solana/web3.js';
import * as bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export wallet keypair to base58 format for Phantom wallet import
 */
async function exportWalletForPhantom() {
  console.log('🔑 Exporting Wallet for Phantom...\n');

  // Read wallet-keypair.json
  const keypairPath = path.join(__dirname, 'wallet-keypair.json');
  
  if (!fs.existsSync(keypairPath)) {
    console.error('❌ wallet-keypair.json not found!');
    console.error(`Expected location: ${keypairPath}`);
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  
  // Load keypair
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  // Convert to base58 (Phantom format)
  const privateKeyBase58 = bs58.encode(keypair.secretKey);
  
  console.log('✅ Wallet Details:\n');
  console.log('Public Key (Address):');
  console.log(`  ${keypair.publicKey.toBase58()}`);
  console.log('\nPrivate Key (Base58 - for Phantom import):');
  console.log(`  ${privateKeyBase58}`);
  console.log('\n' + '='.repeat(80));
  console.log('\n📱 How to Import into Phantom:\n');
  console.log('1. Open Phantom wallet');
  console.log('2. Click the menu (☰) → Add / Connect Wallet');
  console.log('3. Select "Import Private Key"');
  console.log('4. Paste the Private Key shown above');
  console.log('5. Give it a name and click "Import"');
  console.log('\n⚠️  SECURITY WARNING:');
  console.log('   - Never share this private key with anyone!');
  console.log('   - Delete this output from your terminal history after use');
  console.log('   - Consider this wallet compromised if exposed');
  console.log('\n' + '='.repeat(80) + '\n');
}

exportWalletForPhantom().catch(console.error);
