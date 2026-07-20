export const DEAL_STAGES = [
  'NEW',
  'RATE_CALCULATION',
  'RATE_SENT',
  'AGREED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
  'REJECTED',
] as const;

export const DEAL_PIPELINE_STAGES = DEAL_STAGES.filter((stage) => stage !== 'REJECTED');
export const DEAL_REJECT_REASONS = ['EXPENSIVE', 'TIMING', 'COMPETITOR', 'NO_CONTACT', 'OTHER'] as const;

export type DealStage = (typeof DEAL_STAGES)[number];
export type RejectReason = (typeof DEAL_REJECT_REASONS)[number];

export interface DealReference {
  id: string;
  name: string;
}

export interface DealLegalEntity extends DealReference {
  numberingPrefix: string;
}

export interface Deal {
  id: string;
  number: string;
  client: DealReference;
  legalEntity: DealLegalEntity;
  responsible: { id: string; fullName: string };
  department: DealReference | null;
  stage: DealStage;
  rejectReason: RejectReason | null;
  rejectComment: string | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  _count: { transportations: number };
}

export const DEAL_STAGE_COLORS: Record<DealStage, { background: string; color: string }> = {
  NEW: { background: '#EDF0F4', color: '#66707D' },
  RATE_CALCULATION: { background: '#E7E9FD', color: '#4F46E5' },
  RATE_SENT: { background: '#DCEFFB', color: '#0369A1' },
  AGREED: { background: '#D5F0EC', color: '#0F766E' },
  IN_PROGRESS: { background: '#FDF0D5', color: '#B45309' },
  COMPLETED: { background: '#DCF5E4', color: '#15803D' },
  CLOSED: { background: '#E4F2E8', color: '#166534' },
  REJECTED: { background: '#FDE7E5', color: '#B91C1C' },
};
