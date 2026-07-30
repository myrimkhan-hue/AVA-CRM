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

export type TransportationStatus =
  | 'REQUEST_ACCEPTED'
  | 'CARGO_PICKED'
  | 'IN_TRANSIT'
  | 'CUSTOMS'
  | 'DELIVERED'
  | 'CLOSED';

export type DealStage =
  | 'NEW'
  | 'RATE_CALCULATION'
  | 'RATE_SENT'
  | 'AGREED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'REJECTED';

export interface MarginTotals {
  incomeTotalKzt: number;
  expenseTotalKzt: number;
  marginKzt: number;
  marginPercent: number;
  paidByClientKzt: number;
  paidToSubcontractorsKzt: number;
  currencyDifferenceKzt: number;
  isForecast: boolean;
}

export interface DashboardFinanceRow extends MarginTotals {
  legalEntityId?: string;
  legalEntityName?: string;
  managerId?: string;
  managerName?: string;
}

export interface DashboardResult {
  period: { from: string; to: string };
  transportations: {
    byStatus: Array<{ status: TransportationStatus; count: number }>;
    activeCount: number;
  };
  dealsFunnel: {
    byStage: Array<{ stage: DealStage; count: number }>;
    totalDeals: number;
    agreedCount: number;
    conversionPercent: number;
  };
  finance: {
    total: MarginTotals;
    byLegalEntity: DashboardFinanceRow[];
    byManager: DashboardFinanceRow[];
  };
  topDebtors: Array<{ clientId: string; clientName: string; balanceKzt: number }>;
  topCreditors: Array<{ payeeId: string; payeeName: string; amountKzt: number }>;
  cashCalendar: CashCalendarResult;
}
