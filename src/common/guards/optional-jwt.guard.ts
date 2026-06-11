import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithHeaders {
  headers: {
    authorization?: string;
  };
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();

    if (!request.headers.authorization) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null,
    info: unknown,
  ): TUser | null {
    if (err || info) {
      throw err || new UnauthorizedException('Invalid token');
    }

    return user || null;
  }
}
