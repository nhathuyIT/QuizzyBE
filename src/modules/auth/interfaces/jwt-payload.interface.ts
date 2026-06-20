import { RoleType } from '../../../common/enums/role-type.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleType;
  tokenVersion: number;
}
