import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { RoleType } from '../../common/enums/role-type.enum';
import { UserDocument } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AuthResponse,
  AuthUserResponse,
} from './interfaces/auth-response.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthUserResponse> {
    const email = this.normalizeEmail(registerDto.email);
    const existingUser = await this.userService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email này đã được đăng ký');
    }

    const passwordHash = await hash(registerDto.password, 10);
    const user = await this.userService.createUser({
      email,
      passwordHash,
      name: registerDto.name.trim(),
      role: RoleType.STUDENT,
    });

    return this.toAuthUser(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(loginDto.email);
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status === 'suspended' || user.isDeleted) {
      throw new UnauthorizedException('Account is unavailable');
    }

    const loggedInUser = await this.userService.markLogin(user._id.toString());

    return this.buildAuthResponse(loggedInUser);
  }

  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.userService.findById(userId);

    return this.toAuthUser(user);
  }

  async logout(userId: string) {
    await this.userService.invalidateTokens(userId);

    return { loggedOut: true };
  }

  private async buildAuthResponse(user: UserDocument): Promise<AuthResponse> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role as RoleType,
      tokenVersion: user.tokenVersion ?? 0,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '7d',
      user: this.toAuthUser(user),
    };
  }

  private toAuthUser(user: UserDocument): AuthUserResponse {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role as RoleType,
      avatarUrl: user.avatarUrl,
      totalPoints: user.totalPoints,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
