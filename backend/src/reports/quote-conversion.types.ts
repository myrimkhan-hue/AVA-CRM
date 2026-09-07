import { DealRejectReason } from '@prisma/client';

export interface QuoteConversionMetrics {
  total: number;
  won: number;
  lost: number;
  inProgress: number;
  conversionPercent: number;
}

export interface QuoteConversionPerson extends QuoteConversionMetrics {
  id: string | null;
  name: string | null;
}

export interface QuoteConversionDirection extends QuoteConversionMetrics {
  id: string;
  originPoint: string;
  destinationPoint: string;
}

export interface QuoteConversionResult {
  period: { from: string; to: string };
  summary: QuoteConversionMetrics;
  byManager: QuoteConversionPerson[];
  byLogist: QuoteConversionPerson[];
  byDirection: QuoteConversionDirection[];
  byRejectReason: Array<{ reason: DealRejectReason | null; count: number; sharePercent: number }>;
  stalledRateSentCount: number;
  stalledDays: number;
}
