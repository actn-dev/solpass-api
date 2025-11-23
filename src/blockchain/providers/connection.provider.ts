import { Connection } from '@solana/web3.js';
import { ConfigType } from '@nestjs/config';
import { SOLANA_CONNECTION } from '../constants/solana.constants';
import { solanaConfig } from '../../config/solana.config';

export const ConnectionProvider = {
  provide: SOLANA_CONNECTION,
  useFactory: (config: ConfigType<typeof solanaConfig>) => {
    return new Connection(config.rpcUrl, 'confirmed');
  },
  inject: [solanaConfig.KEY],
};
