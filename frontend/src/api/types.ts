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
  documentName: string | null;
  documentPhone: string | null;
  departmentId: string | null;
  department: Department | null;
  roles: string[];
  isActive: boolean;
  motivationRatePercent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentContactRecord {
  id: string;
  fullName: string;
  phone: string | null;
  documentName: string | null;
  documentPhone: string | null;
}

export type DocumentPaymentTextType =
  | 'PAYMENT_METHOD'
  | 'PAYMENT_CONDITIONS';

export interface DocumentPaymentTextRecord {
  id: string;
  type: DocumentPaymentTextType;
  shortName: string;
  text: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPaymentTextOptionsResponse {
  items: DocumentPaymentTextRecord[];
  defaults: Record<DocumentPaymentTextType, DocumentPaymentTextRecord | null>;
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
  kbe: string | null;
  paymentPurposeCode: string | null;
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

export type GeneratedDocumentType =
  | 'CONTRACT'
  | 'TRANSPORT_REQUEST'
  | 'INVOICE';

export type GeneratedDocumentSource =
  | { type: 'DEAL'; id: string; number: string | null }
  | { type: 'TRANSPORTATION'; id: string; number: string | null }
  | {
      type: 'INVOICE';
      id: string;
      number: string | null;
      transportationId: string | null;
    };

export interface GeneratedDocumentRecord {
  id: string;
  type: GeneratedDocumentType;
  number: string;
  generatedAt: string;
  generatedBy: { id: string; fullName: string };
  legalEntity: { id: string; name: string } | null;
  contractor: { id: string; name: string } | null;
  source: GeneratedDocumentSource | null;
}

export type DocumentTemplateType = 'CONTRACT' | 'TRANSPORT_REQUEST' | 'INVOICE';

export interface DocumentTemplateRecord {
  id: string;
  type: DocumentTemplateType;
  displayName: string;
  originalName: string;
  sizeBytes: number;
  isActive: boolean;
  note: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; fullName: string };
}

export interface DocumentTemplateListResponse {
  templates: DocumentTemplateRecord[];
  placeholders: Record<DocumentTemplateType, string[]>;
  requiredPlaceholders: Record<DocumentTemplateType, string[]>;
  maxUploadMb: number;
}

export interface DocumentTemplateMutationResponse {
  template: DocumentTemplateRecord;
  unknownPlaceholders: string[];
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
