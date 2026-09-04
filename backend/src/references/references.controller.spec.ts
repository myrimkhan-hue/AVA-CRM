import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ReferencesController } from './references.controller';

describe('ReferencesController users', () => {
  const findMany = jest.fn();
  const controller = new ReferencesController({
    user: { findMany },
  } as unknown as PrismaService);

  beforeEach(() => findMany.mockReset());

  it.each(['MANAGER', 'LOGIST'])('доступен роли %s', (role) => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => ReferencesController.prototype.users,
      getClass: () => ReferencesController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [role] } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('возвращает только активных сотрудников без email и телефона', async () => {
    findMany.mockResolvedValue([
      {
        id: 'user-1',
        fullName: 'Иван Иванов',
        roles: [{ role: { code: 'LOGIST' } }],
        department: { id: 'department-1', name: 'Логистика' },
        isActive: true,
      },
    ]);

    const result = await controller.users();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        roles: { select: { role: { select: { code: true } } } },
        department: { select: { id: true, name: true } },
        isActive: true,
      },
      orderBy: { fullName: 'asc' },
    });
    expect(result[0]).not.toHaveProperty('email');
    expect(result[0]).not.toHaveProperty('phone');
    expect(result[0].roles).toEqual(['LOGIST']);
  });
});
