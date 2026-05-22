import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoleType } from '../enums/role-type.enum';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: RoleType;
}

interface RequestWithUser {
  user?: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserPayload | undefined,
    ctx: ExecutionContext,
  ):
    | CurrentUserPayload
    | CurrentUserPayload[keyof CurrentUserPayload]
    | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
