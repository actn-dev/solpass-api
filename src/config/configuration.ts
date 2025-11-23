import { registerAs } from '@nestjs/config';

export class SolanaConfig {
  rpcUrl: string;
  serverWalletSecretKey: string;
  network: 'devnet' | 'mainnet-beta' | 'testnet';
  programId: string;
}

export default registerAs('solana', (): SolanaConfig => {
  const serverWalletSecretKey = process.env.SERVER_WALLET_SECRET_KEY;
  if (!serverWalletSecretKey)
    throw new Error('SERVER_WALLET_SECRET_KEY is required in .env');

  return {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    network:
      (process.env.SOLANA_CLUSTER as SolanaConfig['network']) ?? 'devnet',
    serverWalletSecretKey: serverWalletSecretKey,
    programId: process.env.PROGRAM_ID!,
  };
});
