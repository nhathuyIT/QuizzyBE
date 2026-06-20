import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { RoleType } from '../../../common/enums/role-type.enum';
import { UserService } from '../../user/user.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'bot',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const user = await this.userService.findByIdForAuth(payload.sub);

    if (!user || user.isDeleted || user.status === 'suspended') {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role as RoleType,
    };
  }
}
