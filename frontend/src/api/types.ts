export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  departmentId: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Department {
  id: string;
  name: string;
}

export interface Role {
  code: string;
  name: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  departmentId: string | null;
  department: Department | null;
  roles: string[];
  isActive: boolean;
  motivationRatePercent: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaxRegime = 'GENERAL' | 'SIMPLIFIED' | 'OTHER';
export type TaxRateKind = 'VAT' | 'INCOME_TAX';

export interface LegalEntityRecord {
  id: string;
  name: string;
  numberingPrefix: string;
  bin: string | null;
  legalAddress: string | null;
  taxRegime: TaxRegime;
  isActive: boolean;
  legalForm: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankBik: string | null;
  signerPosition: string | null;
  signerFullName: string | null;
  signerShortName: string | null;
  signBasis: string | null;
  talonNumber: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalEntityTaxRate {
  id: string;
  legalEntityId: string;
  kind: TaxRateKind;
  ratePercent: string;
  isVatPayer: boolean | null;
  effectiveFrom: string;
  note: string | null;
  createdAt: string;
  createdByUserId: string | null;
  createdBy: { id: string; fullName: string } | null;
}

export interface CurrencyRecord {
  code: string;
  name: string;
  isBase: boolean;
  isActive: boolean;
}

export type RateSource = 'NBRK_AUTO' | 'MANUAL';

export interface ExchangeRateRecord {
  currencyCode: string;
  rateDate: string;
  rate: string;
  source: RateSource;
  createdByUserId: string | null;
  createdAt: string;
  currency: CurrencyRecord;
  createdBy: { id: string; fullName: string } | null;
}

export type AttachmentEntityType =
  | 'DEAL'
  | 'TRANSPORTATION'
  | 'CONTRACTOR'
  | 'INVOICE'
  | 'PAYMENT_REQUEST'
  | 'CONTRACT';

export interface AttachmentRecord {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; fullName: string };
}

export interface AttachmentLimits {
  maxUploadMb: number;
  allowedExtensions: string[];
}

export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export interface ContractRecord {
  id: string;
  contractorId: string;
  legalEntityId: string;
  number: string;
  signedAt: string;
  validUntil: string | null;
  status: ContractStatus;
  terminatedAt: string | null;
  subject: string | null;
  notes: string | null;
  expiryNotifiedAt: string | null;
  createdById: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contractor: { id: string; name: string };
  legalEntity: { id: string; name: string; numberingPrefix: string };
  createdBy: { id: string; fullName: string };
  daysUntilExpiry: number | null;
  attachmentEntityType: 'CONTRACT';
}

export interface LegalEntityReference {
  id: string;
  name: string;
  numberingPrefix: string;
}

export interface FetchNbrkResult {
  requestedDate: string;
  publishedDate: string | null;
  received: number;
  saved: number;
  skippedManual: number;
  missingCurrencyCodes: string[];
}
