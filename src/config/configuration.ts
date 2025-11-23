import { registerAs } from '@nestjs/config';

export default registerAs('solana', () => ({
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  cluster: process.env.SOLANA_CLUSTER || 'devnet',
  programId: process.env.PROGRAM_ID,
  usdcMint: process.env.USDC_MINT,
  serverWalletSecretKey: process.env.SERVER_WALLET_SECRET_KEY,
}));
