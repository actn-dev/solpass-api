import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard(['jwt', 'api-key']) {
  constructor() {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Try JWT first (if Authorization header starts with 'Bearer ' and looks like JWT)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // JWT tokens have 3 parts separated by dots
      if (token.split('.').length === 3) {
        try {
          return (await super.canActivate(context)) as boolean;
        } catch (error) {
          // If JWT fails, try API key
        }
      }
      
      // If not JWT format, try as API key
      try {
        return (await super.canActivate(context)) as boolean;
      } catch (error) {
        throw new UnauthorizedException('Invalid authentication credentials');
      }
    }

    // No auth header
    throw new UnauthorizedException('No authentication credentials provided');
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }
    return user;
  }
}
