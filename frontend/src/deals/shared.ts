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
  NEW: { background: 'var(--card2)', color: 'var(--text3)' },
  RATE_CALCULATION: { background: 'var(--indigo-soft)', color: 'var(--indigo-fg)' },
  RATE_SENT: { background: 'var(--blue-soft)', color: 'var(--blue-fg)' },
  AGREED: { background: 'var(--teal-soft)', color: 'var(--teal-fg)' },
  IN_PROGRESS: { background: 'var(--amber-soft)', color: 'var(--amber-fg)' },
  COMPLETED: { background: 'var(--green-soft)', color: 'var(--green-fg)' },
  CLOSED: { background: 'var(--purple-soft)', color: 'var(--purple-fg)' },
  REJECTED: { background: 'var(--red-soft)', color: 'var(--red-fg)' },
};
