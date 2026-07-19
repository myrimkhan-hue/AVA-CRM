import { Request } from 'express';
import { AuthUser } from './auth-user.type';

export interface AuthRequest extends Request {
  user: AuthUser;
}
