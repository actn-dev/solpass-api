import { registerAs } from '@nestjs/config';

export const solanaConfig = registerAs('solana', () => {
  const serverWalletSecretKey = process.env.SOLANA_SERVER_SECRET;
  if (!serverWalletSecretKey) {
    throw new Error('SOLANA_SERVER_SECRET is required in .env');
  }

  const programId = process.env.SOLANA_PROGRAM_ID;
  if (!programId) {
    throw new Error('SOLANA_PROGRAM_ID is required in .env');
  }

  return {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    network:
      (process.env.SOLANA_CLUSTER as 'devnet' | 'mainnet-beta' | 'testnet') ||
      'devnet',
    serverWalletSecretKey,
    programId,
  };
});
