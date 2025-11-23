import { Keypair } from '@solana/web3.js';
import { ConfigService } from '@nestjs/config';
import { SERVER_WALLET } from '../constants/solana.constants';
import { SolanaConfig } from 'src/config/configuration';

export const WalletProvider = {
  provide: SERVER_WALLET,
  useFactory: (configService: ConfigService) => {
    const secretKey =
      configService.getOrThrow<SolanaConfig>('solana').serverWalletSecretKey;

    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    return Keypair.fromSecretKey(secretKeyBuffer);
  },
  inject: [ConfigService],
};
