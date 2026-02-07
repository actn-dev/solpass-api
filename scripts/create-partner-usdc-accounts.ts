import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Server wallet - TRY MULTIPLE FORMATS
const SERVER_SECRET = process.env.SOLANA_SERVER_SECRET || '';

function loadServerWallet(): Keypair {
  if (!SERVER_SECRET) {
    throw new Error('SOLANA_SERVER_SECRET not set!');
  }

  // Try different formats
  try {
    // Format 1: JSON array [1,2,3,...]
    if (SERVER_SECRET.startsWith('[')) {
      const secretArray = JSON.parse(SERVER_SECRET);
      return Keypair.fromSecretKey(Uint8Array.from(secretArray));
    }
    
    // Format 2: Base64
    try {
      const decoded = Buffer.from(SERVER_SECRET, 'base64');
      if (decoded.length === 64) {
        return Keypair.fromSecretKey(decoded);
      }
    } catch {}
    
    // Format 3: Base58
    const bs58 = require('bs58');
    const decoded = bs58.decode(SERVER_SECRET);
    return Keypair.fromSecretKey(decoded);
    
  } catch (error) {
    console.error('❌ Failed to load wallet. Secret key format unknown.');
    console.error('Expected formats:');
    console.error('  - JSON array: [1,2,3,...]');
    console.error('  - Base58: 5Kb8o...');
    console.error('  - Base64: abc123...');
    throw error;
  }
}

// Partner public keys
const PARTNER_PUBKEYS = [
  'CD8bTqYcRvEvG1y73S5yZMP4PmXkqiMaP9NYvx6vxGbo',
  'E6R7hsTFCom2X24ZA3TwQM6m3aCY4r67jGTWagbsDtLq',
  '6koGwhYQdGYpqvivd4BBergSagjuUaT9Ytiy1vUDLZRY',
];

async function createUsdcAccounts() {
  console.log('🚀 Creating USDC token accounts for partners...\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  const serverWallet = loadServerWallet();
  
  console.log(`Server wallet: ${serverWallet.publicKey.toBase58()}`);
  console.log(`USDC Mint: ${USDC_MINT.toBase58()}\n`);

  for (let i = 0; i < PARTNER_PUBKEYS.length; i++) {
    const partnerPubkey = new PublicKey(PARTNER_PUBKEYS[i]);
    
    console.log(`Partner ${i + 1}: ${partnerPubkey.toBase58()}`);
    
    const tokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      partnerPubkey,
      false
    );
    
    console.log(`  Token account: ${tokenAccount.toBase58()}`);
    
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    
    if (accountInfo) {
      console.log(`  ✓ Already exists\n`);
      continue;
    }
    
    console.log(`  ⏳ Creating...`);
    
    const instruction = createAssociatedTokenAccountInstruction(
      serverWallet.publicKey,
      tokenAccount,
      partnerPubkey,
      USDC_MINT
    );
    
    const { Transaction } = await import('@solana/web3.js');
    const tx = new Transaction().add(instruction);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = serverWallet.publicKey;
    tx.sign(serverWallet);
    
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`  ✅ Created! Signature: ${signature}\n`);
  }
  
  console.log('🎉 All partner USDC accounts created!');
}

createUsdcAccounts().catch(console.error);