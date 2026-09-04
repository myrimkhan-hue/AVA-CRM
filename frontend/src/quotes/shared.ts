import type { Dayjs } from 'dayjs';

export const QUOTE_STAGES = ['NEW', 'RATE_CALCULATION', 'RATE_SENT', 'REJECTED'] as const;
export const DELIVERY_TERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
export const QUOTE_CURRENCIES = ['KZT', 'USD'] as const;
export const QUOTE_MANAGER_ROLES = ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'];

export type QuoteStage = (typeof QUOTE_STAGES)[number];
export type DeliveryTerms = (typeof DELIVERY_TERMS)[number];
export type QuoteCurrency = (typeof QUOTE_CURRENCIES)[number];
export type QuoteTransportMode = 'AUTO' | 'RAIL' | 'SEA' | 'AIR' | 'MULTIMODAL';
export type QuoteRejectReason = 'EXPENSIVE' | 'TIMING' | 'COMPETITOR' | 'NO_CONTACT' | 'OTHER';

export interface QuoteOption {
  id: string;
  sequence: number;
  vehicleType: string | null;
  carrier: { id: string; name: string } | null;
  carrierId: string | null;
  costRate: string | number | null;
  costRateCurrency: string | null;
  costRateKzt?: string | null;
  clientRate?: string | number | null;
  clientRateCurrency?: string | null;
  clientRateKzt?: string | null;
  transitDays: number | null;
  notes: string | null;
  isSelected: boolean;
}

export interface Quote {
  id: string;
  number: string;
  originPoint: string;
  destinationPoint: string;
  cargoName: string | null;
  weightKg: string | number | null;
  volumeM3: string | number | null;
  placesCount: number | null;
  placesUnit: string | null;
  isDangerous: boolean;
  deliveryTerms: DeliveryTerms | null;
  cargoReadyDate: string | null;
  transportMode: QuoteTransportMode;
  clientRate?: string | number | null;
  clientRateCurrency?: string | null;
  createdAt: string;
  deal: {
    id: string;
    number: string;
    stage: QuoteStage;
    clientTargetRate: string | number | null;
    clientTargetRateCurrency: string | null;
    clientTargetRateKzt?: string | null;
    quoteRateDate: string | null;
    client: { id: string; name: string };
    legalEntity: { id: string; name: string; numberingPrefix?: string };
    responsible: { id: string; fullName: string };
    department: { id: string; name: string } | null;
  };
  logist: { id: string; fullName: string };
  quoteOptions: QuoteOption[];
}

export interface QuoteListResponse {
  items: Quote[];
  total: number;
  page: number;
  limit: number;
}

export interface QuoteUserReference {
  id: string;
  fullName: string;
  roles: string[];
  department: { id: string; name: string } | null;
  isActive: boolean;
}

export interface QuoteReference {
  id: string;
  name: string;
  numberingPrefix?: string;
}

export interface QuoteFormValues {
  clientMode: 'existing' | 'new';
  clientId?: string;
  clientName?: string;
  legalEntityId: string;
  responsibleId?: string;
  logistId: string;
  departmentId?: string;
  originPoint: string;
  destinationPoint: string;
  cargoName?: string;
  weightKg?: number;
  volumeM3?: number;
  placesCount?: number;
  placesUnit?: string;
  isDangerous: boolean;
  deliveryTerms?: DeliveryTerms;
  cargoReadyDate?: Dayjs;
  transportMode: QuoteTransportMode;
  /** Тип ТС из заявки. Если указан — при создании появится первый вариант расчёта с ним. */
  vehicleType?: string;
  clientTargetRate?: number;
  clientTargetRateCurrency?: QuoteCurrency;
  quoteRateDate?: Dayjs;
}

export interface QuoteOptionFormValues {
  vehicleType?: string;
  carrierId?: string;
  costRate?: number;
  costRateCurrency?: QuoteCurrency;
  clientRate?: number;
  clientRateCurrency?: QuoteCurrency;
  transitDays?: number;
  notes?: string;
}

export function hasManagerQuoteRights(roles: string[] | undefined): boolean {
  return Boolean(roles?.some((role) => QUOTE_MANAGER_ROLES.includes(role)));
}

export function quotePayload(values: QuoteFormValues) {
  const { clientMode: _clientMode, cargoReadyDate, quoteRateDate, ...fields } = values;
  return {
    ...fields,
    clientId: values.clientMode === 'existing' ? values.clientId : undefined,
    clientName: values.clientMode === 'new' ? values.clientName?.trim() : undefined,
    cargoReadyDate: cargoReadyDate?.format('YYYY-MM-DD'),
    quoteRateDate: quoteRateDate?.format('YYYY-MM-DD'),
    vehicleType: values.vehicleType?.trim() || undefined,
  };
}
