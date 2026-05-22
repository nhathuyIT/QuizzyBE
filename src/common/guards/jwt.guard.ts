import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO(auth): Cấu hình JwtStrategy/JwtService rồi đọc token, verify,
    // sau đó gắn payload vào request.user cho @CurrentUser() và RolesGuard.
    // Giữ class này để team có sẵn file guard chuẩn NestJS khi đưa lên Git.
    throw new UnauthorizedException('JwtAuthGuard chưa được cấu hình');
  }
}
