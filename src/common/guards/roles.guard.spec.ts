import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '../enums/role-type.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (role?: RoleType) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: role
            ? { id: 'user-id', email: 'user@example.com', role }
            : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  it('allows an admin when admin role is required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleType.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(RoleType.ADMIN))).toBe(true);
  });

  it.each([RoleType.STUDENT, RoleType.TEACHER])(
    'rejects role %s when admin role is required',
    (role) => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue([RoleType.ADMIN]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(() => guard.canActivate(createContext(role))).toThrow(
        ForbiddenException,
      );
    },
  );
});
