import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest } from '../auth-request.type';
import { AuthUser } from '../auth-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
