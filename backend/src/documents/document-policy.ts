import { GeneratedDocumentType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { dealVisibilityWhere } from '../deals/deal-policy';
import { invoiceVisibilityWhere } from '../invoices/invoice-policy';
import { transportationVisibilityWhere } from '../transportations/transportation-policy';

const EMPLOYEE_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'DEPARTMENT_HEAD',
  'MANAGER',
  'LOGIST',
  'FINANCIER',
];

export function generatedDocumentVisibilityWhere(
  user: AuthUser,
): Prisma.GeneratedDocumentWhereInput {
  if (user.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role))) return {};

  const canSeeContractors = user.roles.some((role) => EMPLOYEE_ROLES.includes(role));

  return {
    OR: [
      {
        type: GeneratedDocumentType.CONTRACT,
        OR: [
          {
            deal: {
              is: { AND: [{ deletedAt: null }, dealVisibilityWhere(user)] },
            },
          },
          ...(canSeeContractors
            ? [{
                dealId: null,
                contractor: { is: { deletedAt: null } },
              }]
            : []),
        ],
      },
      {
        type: GeneratedDocumentType.TRANSPORT_REQUEST,
        transportation: {
          is: {
            AND: [
              { deletedAt: null, deal: { deletedAt: null } },
              transportationVisibilityWhere(user),
            ],
          },
        },
      },
      {
        type: GeneratedDocumentType.INVOICE,
        invoice: {
          is: { AND: [{ deletedAt: null }, invoiceVisibilityWhere(user)] },
        },
      },
    ],
  };
}
