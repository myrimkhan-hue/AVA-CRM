import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OperatingExpenseTypesController } from './operating-expense-types.controller';
import { OperatingExpensesController } from './operating-expenses.controller';

function contextFor(controller: object, handler: Function, role: string): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles: [role] } }),
    }),
  } as unknown as ExecutionContext;
}

describe('Доступ к операционным расходам', () => {
  const guard = new RolesGuard(new Reflector());
  const endpoints = [
    [OperatingExpensesController, OperatingExpensesController.prototype.findAll],
    [OperatingExpenseTypesController, OperatingExpenseTypesController.prototype.findAll],
  ] as const;

  it.each(['MANAGER', 'LOGIST'])('возвращает 403 роли %s для расходов и типов', (role) => {
    for (const [controller, handler] of endpoints) {
      expect(() => guard.canActivate(contextFor(controller, handler, role)))
        .toThrow(ForbiddenException);
      try {
        guard.canActivate(contextFor(controller, handler, role));
      } catch (error) {
        expect((error as ForbiddenException).getStatus()).toBe(403);
      }
    }
  });

  it.each(['ADMIN', 'DIRECTOR', 'FINANCIER'])('разрешает роль %s', (role) => {
    for (const [controller, handler] of endpoints) {
      expect(guard.canActivate(contextFor(controller, handler, role))).toBe(true);
    }
  });
});
