import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(
      registerDto.email,
      registerDto.password,
      registerDto.walletAddress,
    );

    // Generate API key (optional)
    const apiKey = this.generateApiKey();
    await this.usersService.updateApiKey(user.id, apiKey);

    const { password, ...result } = user;
    return {
      ...result,
      apiKey,
      message: 'User registered successfully',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.usersService.validatePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(user: User) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      walletAddress: user.walletAddress,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
      },
    };
  }

  async getApiKey(userId: string): Promise<{ apiKey: string }> {
    const user = await this.usersService.findByIdWithApiKey(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.apiKey) {
      // Generate API key if not exists
      const apiKey = this.generateApiKey();
      await this.usersService.updateApiKey(userId, apiKey);
      return { apiKey };
    }

    return { apiKey: user.apiKey };
  }

  async regenerateApiKey(userId: string): Promise<{ apiKey: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const apiKey = this.generateApiKey();
    await this.usersService.updateApiKey(userId, apiKey);

    return { apiKey };
  }

  private generateApiKey(): string {
    // Generate a random API key
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let apiKey = 'sk_';
    for (let i = 0; i < 32; i++) {
      apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return apiKey;
  }
}
