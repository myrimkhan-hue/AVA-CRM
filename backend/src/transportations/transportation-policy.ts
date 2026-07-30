import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma, TransportationStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';

export function transportationVisibilityWhere(user: AuthUser): Prisma.TransportationWhereInput {
  if (user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role))) return {};
  const conditions: Prisma.TransportationWhereInput[] = [];
  if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
    conditions.push({ deal: { departmentId: user.departmentId } });
  }
  if (user.roles.some((role) => ['DEPARTMENT_HEAD', 'MANAGER'].includes(role))) {
    conditions.push({ deal: { responsibleId: user.id } });
  }
  if (user.roles.some((role) => ['DEPARTMENT_HEAD', 'LOGIST'].includes(role))) {
    conditions.push({ logistId: user.id });
  }
  return conditions.length ? { OR: conditions } : { id: { in: [] } };
}

export function canSeeTransportationClientRate(user: AuthUser): boolean {
  return user.roles.some((role) =>
    ['ADMIN', 'DIRECTOR', 'FINANCIER', 'DEPARTMENT_HEAD', 'MANAGER'].includes(role),
  );
}

export function canAssignTransportationResponsible(
  actor: AuthUser,
  candidate: { id: string; departmentId: string | null },
): boolean {
  if (actor.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role))) return true;
  if (actor.roles.includes('DEPARTMENT_HEAD')) {
    return actor.departmentId !== null && candidate.departmentId === actor.departmentId;
  }
  return candidate.id === actor.id;
}

/** Порядок статусов перевозки по разделу 4.3 ТЗ. */
export const TRANSPORTATION_STATUS_ORDER: TransportationStatus[] = [
  TransportationStatus.REQUEST_ACCEPTED,
  TransportationStatus.CARGO_PICKED,
  TransportationStatus.IN_TRANSIT,
  TransportationStatus.CUSTOMS,
  TransportationStatus.DELIVERED,
  TransportationStatus.CLOSED,
];

/**
 * Проверяет допустимость смены статуса и определяет, откат это или движение вперёд.
 * Вперёд можно только на один шаг; назад — на любое число шагов, но такой переход
 * помечается откатом и попадает в журнал (раздел 4.3 ТЗ).
 */
export function resolveStatusTransition(
  current: TransportationStatus,
  target: TransportationStatus,
): { isRollback: boolean } {
  if (current === target) {
    throw new BadRequestException('Перевозка уже имеет этот статус');
  }
  const currentIndex = TRANSPORTATION_STATUS_ORDER.indexOf(current);
  const targetIndex = TRANSPORTATION_STATUS_ORDER.indexOf(target);
  if (targetIndex > currentIndex + 1) {
    throw new BadRequestException('Можно перейти только на следующий статус');
  }
  return { isRollback: targetIndex < currentIndex };
}

export function resolveStatusBusinessEventDate(
  status: TransportationStatus,
  value?: string,
  now = new Date(),
): Date | undefined {
  const needsBusinessDate =
    status === TransportationStatus.CARGO_PICKED || status === TransportationStatus.DELIVERED;
  if (needsBusinessDate && !value) {
    const statusName = status === TransportationStatus.CARGO_PICKED ? 'Груз забран' : 'Доставлен';
    throw new BadRequestException(`Для статуса «${statusName}» укажите дату события`);
  }
  if (!value) return undefined;
  const eventDate = new Date(value);
  if (Number.isNaN(eventDate.getTime())) {
    throw new BadRequestException('Дата события указана неверно');
  }
  if (eventDate.getTime() > now.getTime()) {
    throw new BadRequestException('Дата события не может быть в будущем');
  }
  return eventDate;
}

export function assertCanAssignTransportationResponsible(
  actor: AuthUser,
  candidate: { id: string; departmentId: string | null },
): void {
  if (!canAssignTransportationResponsible(actor, candidate)) {
    throw new ForbiddenException('Недостаточно прав для назначения этого ответственного');
  }
}
