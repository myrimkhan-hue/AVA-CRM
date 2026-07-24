export type MarginItemKind = 'INCOME' | 'EXPENSE';

export interface MarginLineItem {
  id: string;
  kind: MarginItemKind;
  amount: number;
  currencyCode: string;
  isSettled: boolean;
  recordedRateToKzt: number;
  settlementRateToKzt: number;
}

export interface DealMarginInput {
  items: MarginLineItem[];
}

export interface DealMarginResult {
  incomeTotalKzt: number;
  expenseTotalKzt: number;
  marginKzt: number;
  marginPercent: number;
  paidByClientKzt: number;
  paidToSubcontractorsKzt: number;
  currencyDifferenceKzt: number;
  isForecast: boolean;
}

const roundToTwoDecimals = (value: number): number =>
  Math.round(value * 100) / 100;

export function calculateDealMargin(
  input: DealMarginInput,
): DealMarginResult {
  let incomeTotalKzt = 0;
  let expenseTotalKzt = 0;
  let paidByClientKzt = 0;
  let paidToSubcontractorsKzt = 0;
  let plannedIncomeTotalKzt = 0;
  let plannedExpenseTotalKzt = 0;
  let isForecast = false;

  for (const item of input.items) {
    const settlementKzt = item.amount * item.settlementRateToKzt;
    const recordedKzt = item.amount * item.recordedRateToKzt;

    if (item.kind === 'INCOME') {
      incomeTotalKzt += settlementKzt;
      plannedIncomeTotalKzt += recordedKzt;

      if (item.isSettled) {
        paidByClientKzt += settlementKzt;
      }
    } else {
      expenseTotalKzt += settlementKzt;
      plannedExpenseTotalKzt += recordedKzt;

      if (item.isSettled) {
        paidToSubcontractorsKzt += settlementKzt;
      }
    }

    if (!item.isSettled) {
      isForecast = true;
    }
  }

  const marginKzt = incomeTotalKzt - expenseTotalKzt;
  const plannedMarginKzt =
    plannedIncomeTotalKzt - plannedExpenseTotalKzt;
  const marginPercent =
    incomeTotalKzt === 0 ? 0 : (marginKzt / incomeTotalKzt) * 100;

  return {
    incomeTotalKzt: roundToTwoDecimals(incomeTotalKzt),
    expenseTotalKzt: roundToTwoDecimals(expenseTotalKzt),
    marginKzt: roundToTwoDecimals(marginKzt),
    marginPercent: roundToTwoDecimals(marginPercent),
    paidByClientKzt: roundToTwoDecimals(paidByClientKzt),
    paidToSubcontractorsKzt: roundToTwoDecimals(
      paidToSubcontractorsKzt,
    ),
    currencyDifferenceKzt: roundToTwoDecimals(
      marginKzt - plannedMarginKzt,
    ),
    isForecast,
  };
}
