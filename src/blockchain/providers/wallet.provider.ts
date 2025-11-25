import { Keypair } from '@solana/web3.js';
import { ConfigType } from '@nestjs/config';
import { SERVER_WALLET } from '../constants/solana.constants';
import { solanaConfig } from '../../config/solana.config';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

export const WalletProvider = {
  provide: SERVER_WALLET,
  useFactory: (config: ConfigType<typeof solanaConfig>) => {
    try {
      const secretKey = config.serverWalletSecretKey;
      // Decode base58 secret key from SOLANA_SERVER_SECRET env variable
      const secretKeyBuffer = bs58.decode(secretKey);
      const keypair = Keypair.fromSecretKey(secretKeyBuffer);
      console.log(`🔑 Server wallet loaded: ${keypair.publicKey.toBase58()}`);
      return keypair;
    } catch (error) {
      throw new Error(
        `Failed to load server wallet from SOLANA_SERVER_SECRET: ${error.message}`,
      );
    }
  },
  inject: [solanaConfig.KEY],
};
