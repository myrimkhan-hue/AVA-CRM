import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QuotesController } from './quotes.controller';

function context(handler: Function, roles: string[]): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => QuotesController,
    switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }),
  } as unknown as ExecutionContext;
}

describe('Права на исход просчёта', () => {
  const guard = new RolesGuard(new Reflector());
  for (const method of ['sent', 'lose', 'win'] as const) {
    it(`логист не может вызвать ${method}`, () =>
      expect(() =>
        guard.canActivate(
          context(QuotesController.prototype[method], ['LOGIST']),
        ),
      ).toThrow(ForbiddenException));
    it(`менеджер может вызвать ${method}`, () =>
      expect(
        guard.canActivate(
          context(QuotesController.prototype[method], ['MANAGER']),
        ),
      ).toBe(true));
  }
});
