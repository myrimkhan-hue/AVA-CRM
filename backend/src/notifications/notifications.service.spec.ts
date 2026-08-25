import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService: истекающие договоры', () => {
  const today = new Date('2026-07-30T00:00:00.000Z');
  const contract = {
    id: 'contract-1',
    number: 'AVA-001',
    validUntil: new Date('2026-08-20T00:00:00.000Z'),
    terminatedAt: null,
    expiryNotifiedAt: null,
    expiryEscalatedAt: null,
    contractorId: 'contractor-1',
    contractor: { name: 'ТОО Клиент' },
    createdById: 'creator-1',
  };
  const prisma = {
    contract: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    deal: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  } as unknown as PrismaService;
  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(today);
    service = new NotificationsService(prisma);
    jest.spyOn(service, 'notify').mockResolvedValue();
    jest.spyOn(service, 'notifyOnce').mockResolvedValue();
    (prisma.contract.update as jest.Mock).mockResolvedValue(contract);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('выбирает ответственного по последней не удалённой сделке', async () => {
    (prisma.contract.findMany as jest.Mock).mockResolvedValue([contract]);
    (prisma.deal.findMany as jest.Mock).mockResolvedValue([
      { clientId: contract.contractorId, responsibleId: 'manager-new' },
      { clientId: contract.contractorId, responsibleId: 'manager-old' },
    ]);

    await (service as unknown as { checkExpiringContracts(): Promise<void> })
      .checkExpiringContracts();

    expect(prisma.contract.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deletedAt: null,
        terminatedAt: null,
        validUntil: {
          gte: today,
          lte: new Date('2026-08-29T00:00:00.000Z'),
        },
      },
    }));
    expect(prisma.deal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null, clientId: { in: [contract.contractorId] } },
      distinct: ['clientId'],
      orderBy: [{ clientId: 'asc' }, { createdAt: 'desc' }],
    }));
    expect(service.notify).toHaveBeenCalledWith(
      'manager-new',
      NotificationType.CONTRACT_EXPIRING,
      'Договор скоро истекает',
      expect.stringContaining('20.08.2026'),
      'Contractor',
      contract.contractorId,
    );
    expect(service.notifyOnce).not.toHaveBeenCalled();
    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: contract.id },
      data: { expiryNotifiedAt: expect.any(Date) },
    });
  });

  it('уведомляет создателя договора, если сделок с контрагентом нет', async () => {
    (prisma.contract.findMany as jest.Mock).mockResolvedValue([contract]);
    (prisma.deal.findMany as jest.Mock).mockResolvedValue([]);

    await (service as unknown as { checkExpiringContracts(): Promise<void> })
      .checkExpiringContracts();

    expect(service.notify).toHaveBeenCalledWith(
      contract.createdById,
      NotificationType.CONTRACT_EXPIRING,
      expect.any(String),
      expect.any(String),
      'Contractor',
      contract.contractorId,
    );
  });

  it('эскалирует DIRECTOR и DEPARTMENT_HEAD независимо от уведомления менеджера', async () => {
    const escalationContract = {
      ...contract,
      validUntil: new Date('2026-08-06T00:00:00.000Z'),
      expiryNotifiedAt: new Date('2026-07-01T00:00:00.000Z'),
    };
    (prisma.contract.findMany as jest.Mock).mockResolvedValue([escalationContract]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'director-1' },
      { id: 'head-1' },
    ]);

    await (service as unknown as { checkExpiringContracts(): Promise<void> })
      .checkExpiringContracts();

    expect(prisma.deal.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        roles: { some: { role: { code: { in: ['DIRECTOR', 'DEPARTMENT_HEAD'] } } } },
      },
      select: { id: true },
    });
    for (const userId of ['director-1', 'head-1']) {
      expect(service.notify).toHaveBeenCalledWith(
        userId,
        NotificationType.CONTRACT_EXPIRING,
        'Договор всё ещё не продлён',
        expect.stringContaining('всё ещё не продлён и истекает через 7 дн.'),
        'Contractor',
        escalationContract.contractorId,
      );
    }
    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: escalationContract.id },
      data: { expiryEscalatedAt: expect.any(Date) },
    });
  });

  it('не эскалирует в тот же день, когда менеджера предупредили впервые', async () => {
    // Договор завели в систему позже, чем за 7 дней до окончания: сегодня о нём
    // узнаёт только менеджер, руководителей подключаем не раньше следующего дня.
    const lateContract = {
      ...contract,
      validUntil: new Date('2026-08-06T00:00:00.000Z'),
      expiryNotifiedAt: null,
    };
    (prisma.contract.findMany as jest.Mock).mockResolvedValue([lateContract]);
    (prisma.deal.findMany as jest.Mock).mockResolvedValue([
      { clientId: contract.contractorId, responsibleId: 'manager-1' },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'director-1' }]);

    await (service as unknown as { checkExpiringContracts(): Promise<void> })
      .checkExpiringContracts();

    expect(service.notify).toHaveBeenCalledWith(
      'manager-1',
      NotificationType.CONTRACT_EXPIRING,
      'Договор скоро истекает',
      expect.any(String),
      'Contractor',
      contract.contractorId,
    );
    expect(service.notify).not.toHaveBeenCalledWith(
      expect.anything(),
      NotificationType.CONTRACT_EXPIRING,
      'Договор всё ещё не продлён',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(prisma.contract.update).toHaveBeenCalledTimes(1);
    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: lateContract.id },
      data: { expiryNotifiedAt: expect.any(Date) },
    });
  });

  it('доводит эскалацию до менеджера, который сам DIRECTOR', async () => {
    // Тот же человек уже получил предупреждение как менеджер — эскалация не должна
    // быть съедена дедупликацией по паре пользователь+контрагент.
    const escalationContract = {
      ...contract,
      validUntil: new Date('2026-08-06T00:00:00.000Z'),
      expiryNotifiedAt: new Date('2026-07-29T00:00:00.000Z'),
    };
    (prisma.contract.findMany as jest.Mock).mockResolvedValue([escalationContract]);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'director-1' }]);

    await (service as unknown as { checkExpiringContracts(): Promise<void> })
      .checkExpiringContracts();

    expect(service.notify).toHaveBeenCalledWith(
      'director-1',
      NotificationType.CONTRACT_EXPIRING,
      'Договор всё ещё не продлён',
      expect.any(String),
      'Contractor',
      contract.contractorId,
    );
    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: escalationContract.id },
      data: { expiryEscalatedAt: expect.any(Date) },
    });
    expect(service.notifyOnce).not.toHaveBeenCalled();
  });

  it('создаёт отдельные предупреждения для двух договоров одного контрагента', async () => {
    const secondContract = {
      ...contract,
      id: 'contract-2',
      number: 'AVA-002',
      validUntil: new Date('2026-08-21T00:00:00.000Z'),
    };
    (prisma.contract.findMany as jest.Mock).mockResolvedValue([contract, secondContract]);
    (prisma.deal.findMany as jest.Mock).mockResolvedValue([
      { clientId: contract.contractorId, responsibleId: 'manager-1' },
    ]);

    await (service as unknown as { checkExpiringContracts(): Promise<void> })
      .checkExpiringContracts();

    const managerCalls = (service.notify as jest.Mock).mock.calls.filter(
      ([userId, , title]) => userId === 'manager-1' && title === 'Договор скоро истекает',
    );
    expect(managerCalls).toHaveLength(2);
    expect(managerCalls.map((call) => call[3])).toEqual(expect.arrayContaining([
      expect.stringContaining('AVA-001'),
      expect.stringContaining('AVA-002'),
    ]));
    expect(prisma.contract.update).toHaveBeenCalledTimes(2);
  });
});
