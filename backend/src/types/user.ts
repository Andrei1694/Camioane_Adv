import type { User } from '../generated/prisma/client.ts';

export type PublicUser = Pick<User, 'id' | 'email' | 'role'>;
export type SessionUser = PublicUser & Pick<User, 'sessionVersion'>;
export type SessionIdentity = Pick<User, 'id' | 'sessionVersion'>;

export interface UserCredentials {
  email: string;
  password: string;
}

export type CreateUserData = UserCredentials & Pick<User, 'role'>;
export type UpdateUserData = Partial<CreateUserData>;

export interface AuthenticationData {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface UserLocals {
  user?: PublicUser;
  session?: SessionIdentity;
}
