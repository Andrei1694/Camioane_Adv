import type { Role, User } from '../generated/prisma/client.ts';

export type RoleName = Role['name'];
export type PublicUser = Pick<User, 'id' | 'email'> & { role: RoleName };
export type UserWithRole = Pick<User, 'id' | 'email'> & { role: Role };
export type SessionUser = UserWithRole & Pick<User, 'sessionVersion'>;
export type SessionIdentity = Pick<User, 'id' | 'sessionVersion'>;

export interface UserCredentials {
  email: string;
  password: string;
}

export type CreateUserData = UserCredentials & { role: RoleName };
export type UpdateUserData = Partial<CreateUserData>;

export interface AuthenticationData {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface UserLocals {
  user?: PublicUser;
  role?: Role;
  session?: SessionIdentity;
}
