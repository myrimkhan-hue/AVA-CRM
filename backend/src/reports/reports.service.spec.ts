import { ExchangeRatesService } from '../currencies/exchange-rates.service';
import { MarginService } from '../deals/margin.service';
import { PrismaService } from '../prisma/prisma.service';
import { OperatingExpenseDueRow, ReportsService } from './reports.service';

describe('Кассовый календарь с операционными расходами', () => {
  afterEach(() => jest.useRealTimers());

  it('добавляет просроченный расход в overdue, а будущий — в период', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    const service = new ReportsService(
      {} as PrismaService,
      {} as ExchangeRatesService,
      {} as MarginService,
    );
    jest.spyOn(service, 'getReceivables').mockResolvedValue([]);
    jest.spyOn(service, 'getPayables').mockResolvedValue([]);
    const base = {
      typeId: 'type-1',
      typeName: 'Аренда',
      legalEntityId: 'entity-1',
      legalEntityName: 'AVA',
      purpose: 'Аренда офиса',
      amount: '100',
      currencyCode: 'KZT',
      daysOverdue: 0,
    };
    const expenses: OperatingExpenseDueRow[] = [
      {
        ...base,
        operatingExpenseId: 'overdue',
        dueDate: '2026-08-25',
        amountKzt: 100,
        isOverdue: true,
        daysOverdue: 1,
      },
      {
        ...base,
        operatingExpenseId: 'future',
        dueDate: '2026-08-27',
        amountKzt: 250,
        isOverdue: false,
      },
    ];
    jest.spyOn(service, 'getOperatingExpensesDue').mockResolvedValue(expenses);

    const result = await service.getCashCalendar({
      from: '2026-08-26',
      to: '2026-08-27',
      groupBy: 'day',
    });

    expect(result.overdueExpenseKzt).toBe(100);
    expect(result.openingBalanceKzt).toBe(-100);
    expect(result.periods).toEqual([
      expect.objectContaining({ periodStart: '2026-08-26', expectedExpenseKzt: 0, runningBalanceKzt: -100 }),
      expect.objectContaining({ periodStart: '2026-08-27', expectedExpenseKzt: 250, runningBalanceKzt: -350 }),
    ]);
  });
});
