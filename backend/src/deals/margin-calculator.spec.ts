import { calculateDealMargin, DealMarginInput } from './margin-calculator';

describe('calculateDealMargin', () => {
  it('рассчитывает прогнозную маржу, если есть неоплаченная сумма', () => {
    const input: DealMarginInput = {
      items: [
        {
          id: 'client-payment',
          kind: 'INCOME',
          amount: 3000,
          currencyCode: 'USD',
          isSettled: false,
          recordedRateToKzt: 460,
          settlementRateToKzt: 470,
        },
        {
          id: 'subcontractor-payment',
          kind: 'EXPENSE',
          amount: 15000,
          currencyCode: 'CNY',
          isSettled: true,
          recordedRateToKzt: 68,
          settlementRateToKzt: 68,
        },
      ],
    };

    expect(calculateDealMargin(input)).toEqual({
      incomeTotalKzt: 1410000,
      expenseTotalKzt: 1020000,
      marginKzt: 390000,
      marginPercent: 27.66,
      paidByClientKzt: 0,
      paidToSubcontractorsKzt: 1020000,
      currencyDifferenceKzt: 30000,
      isForecast: true,
    });
  });

  it('рассчитывает фактическую маржу и курсовую разницу для оплаченных сумм', () => {
    const input: DealMarginInput = {
      items: [
        {
          id: 'client-payment',
          kind: 'INCOME',
          amount: 3000,
          currencyCode: 'USD',
          isSettled: true,
          recordedRateToKzt: 460,
          settlementRateToKzt: 468,
        },
        {
          id: 'subcontractor-payment',
          kind: 'EXPENSE',
          amount: 15000,
          currencyCode: 'CNY',
          isSettled: true,
          recordedRateToKzt: 68,
          settlementRateToKzt: 68,
        },
      ],
    };

    expect(calculateDealMargin(input)).toEqual({
      incomeTotalKzt: 1404000,
      expenseTotalKzt: 1020000,
      marginKzt: 384000,
      marginPercent: 27.35,
      paidByClientKzt: 1404000,
      paidToSubcontractorsKzt: 1020000,
      currencyDifferenceKzt: 24000,
      isForecast: false,
    });
  });

  it('возвращает нулевые значения для пустого списка операций', () => {
    expect(calculateDealMargin({ items: [] })).toEqual({
      incomeTotalKzt: 0,
      expenseTotalKzt: 0,
      marginKzt: 0,
      marginPercent: 0,
      paidByClientKzt: 0,
      paidToSubcontractorsKzt: 0,
      currencyDifferenceKzt: 0,
      isForecast: false,
    });
  });
});
