import { Role } from '@prisma/client';
import type { Request } from 'express';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  role: Role;
  type: 'refresh';
  jti: string;
  fid: string;
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email: string;
  phone: string;
  isActive: boolean;
  isVerified: boolean;
  name: string;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  accessToken: string;
}

export interface CookieSettings {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
