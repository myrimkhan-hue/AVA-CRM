export const LEAD_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'CALL_BACK',
  'NOT_REACHED',
  'NOT_INTERESTED',
  'CONVERTED',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_NOT_INTERESTED_REASONS = [
  'NOT_NEEDED',
  'HAS_PROVIDER',
  'EXPENSIVE',
  'WRONG_CONTACT',
  'OTHER',
] as const;
export type LeadNotInterestedReason = (typeof LEAD_NOT_INTERESTED_REASONS)[number];

export type LeadSource = 'COLD_CALL_IMPORT' | 'WEBSITE';

export const LEAD_STATUS_COLORS: Record<LeadStatus, { background: string; color: string }> = {
  NEW: { background: '#E7E9FD', color: '#4F46E5' },
  IN_PROGRESS: { background: '#FDF0D5', color: '#B45309' },
  CALL_BACK: { background: '#EFE9FD', color: '#7C3AED' },
  NOT_REACHED: { background: '#EDF0F4', color: '#66707D' },
  NOT_INTERESTED: { background: '#FDE9E9', color: '#B91C1C' },
  CONVERTED: { background: '#DCF5E4', color: '#15803D' },
};

export interface LeadReference { id: string; fullName?: string; name?: string; number?: string; fileName?: string; createdAt?: string }

export interface LeadActivityRecord {
  id: string;
  leadId: string;
  userId: string;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  comment: string;
  callBackAt: string | null;
  createdAt: string;
  user: { id: string; fullName: string };
}

export interface LeadRecord {
  id: string;
  name: string;
  phone: string | null;
  bin: string | null;
  city: string | null;
  contactName: string | null;
  email: string | null;
  notes: string | null;
  source: LeadSource;
  status: LeadStatus;
  notInterestedReason: LeadNotInterestedReason | null;
  notInterestedComment: string | null;
  callBackAt: string | null;
  notReachedAttempts: number;
  isExistingClient: boolean;
  matchedContractorId: string | null;
  responsibleId: string | null;
  departmentId: string | null;
  importBatchId: string | null;
  convertedDealId: string | null;
  convertedContractorId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responsible: { id: string; fullName: string } | null;
  department: { id: string; name: string } | null;
  matchedContractor: { id: string; name: string } | null;
  convertedContractor: { id: string; name: string } | null;
  convertedDeal: { id: string; number: string } | null;
  importBatch: { id: string; fileName: string; createdAt: string } | null;
  activities?: LeadActivityRecord[];
}

export interface LeadImportBatchResult {
  id: string;
  fileName: string;
  rowsTotal: number;
  rowsCreated: number;
  rowsExistingClient: number;
  rowsDuplicateLead: number;
  createdAt: string;
}

export const LEAD_IMPORT_FIELDS = ['name', 'phone', 'bin', 'city', 'contactName', 'email', 'notes'] as const;
export type LeadImportField = (typeof LEAD_IMPORT_FIELDS)[number];

export interface LeadImportRow {
  name: string;
  phone?: string;
  bin?: string;
  city?: string;
  contactName?: string;
  email?: string;
  notes?: string;
}
