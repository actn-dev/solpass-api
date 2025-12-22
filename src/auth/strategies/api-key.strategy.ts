import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async validate(apiKey: string): Promise<any> {
    // Validate that API key exists and starts with expected prefix
    if (!apiKey || !apiKey.startsWith('sk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    // Find user by API key
    const user = await this.usersService.findByApiKey(apiKey);

    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Return user data to be attached to request
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
    };
  }
}
