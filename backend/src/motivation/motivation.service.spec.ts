import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { MotivationService } from './motivation.service';

const logist: AuthUser = {
  id: 'logist-1',
  fullName: 'Логист',
  email: 'logist@ava.local',
  roles: ['LOGIST'],
  departmentId: null,
};

describe('Расчёт мотивации', () => {
  it('исключает черновик просчёта из бонуса даже при дате выгрузки в периоде', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: logist.id,
            fullName: logist.fullName,
            motivationRatePercent: null,
          },
        ]),
      },
      motivationSettings: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'motivation-settings-singleton',
          bonusRatePercent: new Prisma.Decimal(10),
        }),
      },
      transportation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new MotivationService(prisma as never, {} as never);

    await service.getMyReport(logist, '2026-08');

    expect(prisma.transportation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isQuoteDraft: false,
          unloadingEventDate: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lte: new Date('2026-08-31T00:00:00.000Z'),
          },
        }),
      }),
    );
  });
});
