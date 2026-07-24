export interface ReceivableRow {
  invoiceId: string;
  invoiceNumber: string;
  transportationId: string;
  transportationNumber: string;
  clientId: string;
  clientName: string;
  legalEntityName: string;
  dueDate: string;
  balanceAmount: string;
  currencyCode: string;
  balanceKzt: number;
  isOverdue: boolean;
  daysOverdue: number;
}

export type PaymentRequestStatus = 'REQUESTED' | 'APPROVED' | 'PAID';

export interface PayableRow {
  paymentRequestId: string;
  transportationId: string;
  transportationNumber: string;
  payeeId: string;
  payeeName: string;
  purpose: string;
  status: PaymentRequestStatus;
  dueDate: string;
  amount: string;
  currencyCode: string;
  amountKzt: number;
  isOverdue: boolean;
  daysOverdue: number;
}

export interface CashCalendarPeriod {
  periodStart: string;
  periodEnd: string;
  expectedIncomeKzt: number;
  expectedExpenseKzt: number;
  netKzt: number;
  runningBalanceKzt: number;
}

export interface CashCalendarResult {
  overdueIncomeKzt: number;
  overdueExpenseKzt: number;
  openingBalanceKzt: number;
  periods: CashCalendarPeriod[];
}
