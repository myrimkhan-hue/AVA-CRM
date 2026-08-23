const DASH = '—';

export interface DocumentContactSource {
  fullName: string;
  phone: string | null;
  documentName: string | null;
  documentPhone: string | null;
}

export function documentContact(source: DocumentContactSource): {
  name: string;
  phone: string;
} {
  return {
    name: source.documentName?.trim() || source.fullName,
    phone: source.documentPhone?.trim() || source.phone?.trim() || DASH,
  };
}
