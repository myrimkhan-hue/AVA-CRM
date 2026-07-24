export type PaymentRequestStatus = 'REQUESTED' | 'APPROVED' | 'PAID';

export interface PaymentRequest {
  id: string;
  transportationId: string;
  legId: string | null;
  amount: string;
  currencyCode: string;
  dueDate: string;
  purpose: string;
  status: PaymentRequestStatus;
  approvedAt: string | null;
  paidAt: string | null;
  actualExchangeRate: string | null;
  deletedAt: string | null;
  createdAt: string;
  transportation: {
    id: string;
    number: string;
    originPoint: string;
    destinationPoint: string;
    deal: {
      id: string;
      number: string;
      responsibleId: string;
      departmentId: string | null;
    };
    logist: { id: string; fullName: string };
  };
  leg: {
    id: string;
    orderIndex: number;
    fromPoint: string;
    toPoint: string;
  } | null;
  payeeContractor: {
    id: string;
    name: string;
    types: string[];
  };
  currency: { code: string; name: string; isBase: boolean };
  createdBy: { id: string; fullName: string };
  approvedBy: { id: string; fullName: string } | null;
  paidBy: { id: string; fullName: string } | null;
}

export const PAYMENT_REQUEST_STATUSES: PaymentRequestStatus[] = [
  'REQUESTED',
  'APPROVED',
  'PAID',
];

export const PAYMENT_REQUEST_STATUS_COLORS: Record<
  PaymentRequestStatus,
  string
> = {
  REQUESTED: 'blue',
  APPROVED: 'orange',
  PAID: 'green',
};
