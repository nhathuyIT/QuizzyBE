import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleType } from '../../../common/enums/role-type.enum';
import { UserService } from '../../user/user.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const payload = {
    sub: '507f1f77bcf86cd799439011',
    email: 'admin@example.com',
    role: RoleType.ADMIN,
    tokenVersion: 2,
  };

  const createStrategy = (user: Record<string, unknown> | null) => {
    const config = { get: jest.fn().mockReturnValue('test-secret') };
    const users = { findByIdForAuth: jest.fn().mockResolvedValue(user) };
    return new JwtStrategy(
      config as unknown as ConfigService,
      users as unknown as UserService,
    );
  };

  it.each([
    null,
    { isDeleted: true, status: 'active', tokenVersion: 2 },
    { isDeleted: false, status: 'suspended', tokenVersion: 2 },
  ])('rejects unavailable users', async (user) => {
    await expect(createStrategy(user).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a revoked token version', async () => {
    const strategy = createStrategy({
      _id: payload.sub,
      email: payload.email,
      role: RoleType.ADMIN,
      status: 'active',
      isDeleted: false,
      tokenVersion: 3,
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns the authenticated admin payload', async () => {
    const strategy = createStrategy({
      _id: { toString: () => payload.sub },
      email: payload.email,
      role: RoleType.ADMIN,
      status: 'active',
      isDeleted: false,
      tokenVersion: 2,
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: payload.sub,
      email: payload.email,
      role: RoleType.ADMIN,
    });
  });
});
