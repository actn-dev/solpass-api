import { registerAs } from '@nestjs/config';

export default registerAs('solana', () => ({
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  cluster: process.env.SOLANA_CLUSTER || 'devnet',
  programId:
    process.env.PROGRAM_ID || 'BVt1LbTYSFaZ7jZghdffdism86BdqcKPrcZ1caajiPAP',
  usdcMint:
    process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  serverWalletSecretKey: process.env.SERVER_WALLET_SECRET_KEY,
}));
