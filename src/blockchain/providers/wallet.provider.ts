import { Keypair } from '@solana/web3.js';
import { ConfigService } from '@nestjs/config';

export const WalletProvider = {
  provide: 'SERVER_WALLET',
  useFactory: (configService: ConfigService) => {
    const secretKey = configService.get<string>('solana.serverWalletSecretKey');

    if (!secretKey) {
      throw new Error('SERVER_WALLET_SECRET_KEY not configured');
    }

    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    return Keypair.fromSecretKey(secretKeyBuffer);
  },
  inject: [ConfigService],
};
