import { registerAs } from '@nestjs/config';

type ExpiresIn = `${number}h` | `${number}d`;

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET!,
  expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as ExpiresIn,
  refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as ExpiresIn,
}));
