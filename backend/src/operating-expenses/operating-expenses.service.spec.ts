import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OperatingExpensesService } from './operating-expenses.service';

describe('Автоповтор операционных расходов', () => {
  it('два последовательных прогона не создают дубль', async () => {
    const source = {
      id: 'expense-1',
      typeId: 'type-1',
      legalEntityId: 'entity-1',
      amount: new Prisma.Decimal('100000.00'),
      currencyCode: 'KZT',
      dueDate: new Date('2026-01-31T00:00:00.000Z'),
      purpose: 'Аренда',
      isRecurringMonthly: true,
      paidAt: null,
      paidByUserId: null,
      deletedAt: null,
      createdByUserId: 'user-1',
      recurringSourceId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    let inserted = false;
    const tx = {
      operatingExpense: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(source)
          .mockResolvedValueOnce(null),
        create: jest.fn().mockImplementation(async () => {
          if (inserted) {
            throw new Prisma.PrismaClientKnownRequestError('duplicate', {
              code: 'P2002',
              clientVersion: 'test',
            });
          }
          inserted = true;
          return { ...source, id: 'expense-2', recurringSourceId: source.id };
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      operatingExpense: { findMany: jest.fn().mockResolvedValue([source]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new OperatingExpensesService(prisma);

    await expect(service.generateMonthlyRecurringExpenses(
      new Date('2026-01-31T12:00:00.000Z'),
    )).resolves.toBe(1);
    await expect(service.generateMonthlyRecurringExpenses(
      new Date('2026-01-31T12:00:00.000Z'),
    )).resolves.toBe(0);

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.operatingExpense.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        recurringSourceId: 'expense-1',
        dueDate: new Date('2026-02-28T00:00:00.000Z'),
        isRecurringMonthly: false,
        paidAt: null,
        paidByUserId: null,
      }),
    });
  });
});
