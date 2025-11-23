import { Connection } from '@solana/web3.js';
import { ConfigService } from '@nestjs/config';

export const ConnectionProvider = {
  provide: 'SOLANA_CONNECTION',
  useFactory: (configService: ConfigService) => {
    const rpcUrl = configService.get<string>('solana.rpcUrl');
    return new Connection(rpcUrl, 'confirmed');
  },
  inject: [ConfigService],
};
