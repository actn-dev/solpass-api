import { Keypair } from '@solana/web3.js';
import { ConfigType } from '@nestjs/config';
import { SERVER_WALLET } from '../constants/solana.constants';
import { solanaConfig } from '../../config/solana.config';

export const WalletProvider = {
  provide: SERVER_WALLET,
  useFactory: (config: ConfigType<typeof solanaConfig>) => {
    const secretKey = config.serverWalletSecretKey;
    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    return Keypair.fromSecretKey(secretKeyBuffer);
  },
  inject: [solanaConfig.KEY],
};
