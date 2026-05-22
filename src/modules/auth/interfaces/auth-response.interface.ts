import { RoleType } from '../../../common/enums/role-type.enum';

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  avatarUrl?: string;
  totalPoints: number;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: AuthUserResponse;
}
