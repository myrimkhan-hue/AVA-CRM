import { AuthUser } from '../auth/auth-user.type';
import { TransportationsService } from '../transportations/transportations.service';
import { QuotesService } from './quotes.service';

const admin: AuthUser = {
  id: 'admin',
  fullName: 'Администратор',
  email: 'admin@ava.local',
  roles: ['ADMIN'],
  departmentId: null,
};

describe('Разделение просчётов и обычных перевозок', () => {
  it('список просчётов выбирает только черновики просчёта', async () => {
    const prisma = {
      transportation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new QuotesService(prisma as never, {} as never);

    await service.findAll({ page: 1, limit: 20 }, admin);

    const query = prisma.transportation.findMany.mock.calls[0][0];
    expect(query.where.AND).toContainEqual(
      expect.objectContaining({ isQuoteDraft: true }),
    );
  });

  it('обычный список перевозок исключает черновики просчёта', async () => {
    const prisma = {
      transportation: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new TransportationsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.findAll({}, admin);

    const query = prisma.transportation.findMany.mock.calls[0][0];
    expect(query.where.AND).toContainEqual(
      expect.objectContaining({ isQuoteDraft: false }),
    );
  });
});
