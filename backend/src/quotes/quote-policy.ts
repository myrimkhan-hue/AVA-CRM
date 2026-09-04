import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import {
  canSeeTransportationClientRate,
  canSeeTransportationClientRateForRow,
  transportationVisibilityWhere,
} from '../transportations/transportation-policy';

export function quoteVisibilityWhere(
  user: AuthUser,
): Prisma.TransportationWhereInput {
  // У финансиста нет самостоятельного права видеть просчёты, но остальные его роли продолжают действовать.
  return transportationVisibilityWhere({
    ...user,
    roles: user.roles.filter((role) => role !== 'FINANCIER'),
  });
}

export function assertCanEditQuoteClientRate(
  user: AuthUser,
  dto: { clientRate?: unknown; clientRateCurrency?: unknown },
): void {
  if (
    !canSeeQuoteClientRate(user) &&
    (dto.clientRate !== undefined || dto.clientRateCurrency !== undefined)
  ) {
    throw new ForbiddenException('Логист не может изменять ставку клиенту');
  }
}

export function canSeeQuoteClientRate(
  user: AuthUser,
  row?: { deal: { departmentId: string | null; responsibleId: string } },
): boolean {
  return row
    ? canSeeTransportationClientRateForRow(user, row)
    : canSeeTransportationClientRate(user);
}

export function presentQuote<
  T extends {
    clientRate: unknown;
    clientRateCurrency: unknown;
    deal: { departmentId: string | null; responsibleId: string };
    quoteOptions: Array<Record<string, unknown>>;
  },
>(row: T, user: AuthUser) {
  if (canSeeQuoteClientRate(user, row)) return row;
  const {
    clientRate: _clientRate,
    clientRateCurrency: _clientRateCurrency,
    quoteOptions,
    ...visible
  } = row;
  return {
    ...visible,
    quoteOptions: quoteOptions.map(
      ({ clientRate: _rate, clientRateCurrency: _currency, ...option }) =>
        option,
    ),
  };
}
