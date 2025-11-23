import { Connection } from '@solana/web3.js';
import { ConfigService } from '@nestjs/config';
import { SOLANA_CONNECTION } from '../constants/solana.constants';
import { SolanaConfig } from 'src/config/configuration';

export const ConnectionProvider = {
  provide: SOLANA_CONNECTION,
  useFactory: (configService: ConfigService) => {
    const rpcUrl = configService.getOrThrow<SolanaConfig>('solana').rpcUrl;
    return new Connection(rpcUrl, 'confirmed');
  },
  inject: [ConfigService],
};
