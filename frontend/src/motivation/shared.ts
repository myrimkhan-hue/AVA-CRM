export type MotivationPaymentStatus = 'full' | 'part' | 'none';

export interface MotivationRow {
  transportationId: string;
  number: string;
  clientName: string;
  route: string;
  unloadingDate: string;
  marginKzt: number;
  isForecast: boolean;
  paymentStatus: MotivationPaymentStatus;
}

export interface MotivationReport {
  userId: string;
  fullName: string;
  ratePercent: number;
  rows: MotivationRow[];
  totalMarginKzt: number;
  totalBonusKzt: number;
}

export const MOTIVATION_PAYMENT_STATUS_COLORS: Record<MotivationPaymentStatus, string> = {
  full: 'green',
  part: 'gold',
  none: 'default',
};
