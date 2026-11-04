import type { User } from '../generated/prisma/client.ts';

export type PublicUser = Pick<User, 'email'>;

export interface UserCredentials {
  email: string;
  password: string;
}

export interface AuthenticationData {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface UserLocals {
  user?: PublicUser;
}
