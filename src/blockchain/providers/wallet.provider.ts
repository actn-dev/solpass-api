import { Keypair } from '@solana/web3.js';
import { ConfigType } from '@nestjs/config';
import { SERVER_WALLET } from '../constants/solana.constants';
import { solanaConfig } from '../../config/solana.config';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

export const WalletProvider = {
  provide: SERVER_WALLET,
  useFactory: (config: ConfigType<typeof solanaConfig>) => {
    const secretKey = config.serverWalletSecretKey;
    const secretKeyBuffer = bs58.decode(secretKey);
    return Keypair.fromSecretKey(secretKeyBuffer);
  },
  inject: [solanaConfig.KEY],
};
