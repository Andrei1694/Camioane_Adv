import type { Role, User, UserAvatar } from '../generated/prisma/client.ts';

export type RoleName = Role['name'];
/** url is relative to the API and needs the bearer token; updatedAt changes with each upload. */
export interface PublicAvatar {
  url: string;
  updatedAt: Date;
}
export type PublicUser = Pick<User, 'id' | 'email'> & { role: RoleName; avatar: PublicAvatar | null };
export type UserWithRole = Pick<User, 'id' | 'email'> & { role: Role; avatar: Pick<UserAvatar, 'updatedAt'> | null };
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
