export type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID';

export interface InvoiceLine {
  id: string;
  sortOrder: number;
  serviceName: string;
  quantity: string;
  unitPrice: string;
  hasVat: boolean;
  vatRatePercent: string | null;
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
}

export interface InvoicePayment {
  id: string;
  paymentDate: string;
  amount: string;
  manualExchangeRate: string | null;
  note: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string };
}

export interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string | null;
  deletedAt: string | null;
  isOverdue: boolean;
  transportation: {
    id: string;
    number: string;
    originPoint: string;
    destinationPoint: string;
    deal: {
      id: string;
      number: string;
      responsible: { id: string; fullName: string };
      department: { id: string; name: string } | null;
    };
  };
  client: { id: string; name: string };
  legalEntity: { id: string; name: string; numberingPrefix: string };
  currency: { code: string; name: string; isBase: boolean };
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  totals: {
    netAmount: string;
    vatAmount: string;
    totalAmount: string;
    paidAmount: string;
    balanceAmount: string;
  };
}

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
];

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  ISSUED: 'blue',
  PARTIALLY_PAID: 'orange',
  PAID: 'green',
};
