import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user/partner' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or wallet already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Request() req, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile (verify JWT token)' })
  @ApiResponse({
    status: 200,
    description: 'Returns current user information',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async getProfile(@Request() req) {
    // req.user is populated by JwtStrategy from the JWT token
    const { password, ...userWithoutPassword } = req.user;
    return {
      success: true,
      user: userWithoutPassword,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('api-key')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get API key for programmatic access (JWT required)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns API key',
    schema: {
      example: {
        apiKey: 'sk_abc123...',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async getApiKey(@Request() req) {
    return this.authService.getApiKey(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('regenerate-key')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Regenerate API key (invalidates old key, JWT required)',
  })
  @ApiResponse({
    status: 200,
    description: 'New API key generated',
    schema: {
      example: {
        apiKey: 'sk_xyz789...',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async regenerateApiKey(@Request() req) {
    return this.authService.regenerateApiKey(req.user.userId);
  }
}
