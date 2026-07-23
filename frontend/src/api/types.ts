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
