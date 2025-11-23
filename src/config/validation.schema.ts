import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_SECRET: Joi.string().optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Solana
  SOLANA_RPC_URL: Joi.string().uri().default('https://api.devnet.solana.com'),
  SOLANA_CLUSTER: Joi.string()
    .valid('devnet', 'mainnet-beta', 'testnet')
    .default('devnet'),
  SOLANA_SERVER_SECRET: Joi.string().required(),
  SOLANA_PROGRAM_ID: Joi.string().required(),
});
