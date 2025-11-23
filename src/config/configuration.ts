export class SolanaConfig {
  rpcUrl: string;
  serverWalletSecretKey: string;
  network: 'devnet' | 'mainnet-beta' | 'testnet';
  programId: string;
}

export class DatabaseConfig {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export class JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'solpass',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  } as DatabaseConfig,

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as JwtConfig,

  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    network:
      (process.env.SOLANA_CLUSTER as SolanaConfig['network']) ?? 'devnet',
    serverWalletSecretKey: process.env.SERVER_WALLET_SECRET_KEY || '',
    programId: process.env.PROGRAM_ID || '',
  } as SolanaConfig,
});
