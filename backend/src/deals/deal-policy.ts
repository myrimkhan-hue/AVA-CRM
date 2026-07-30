import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';

/**
 * Кто какие сделки видит (раздел 3 ТЗ):
 * администратор, руководитель и финансист — все; руководитель отдела — сделки
 * своего отдела и свои; менеджер — только свои. Остальным ролям (логист) сделки
 * не видны — возвращается заведомо пустое условие.
 */
export function dealVisibilityWhere(user: AuthUser): Prisma.DealWhereInput {
  if (user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role))) return {};
  const conditions: Prisma.DealWhereInput[] = [];
  if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
    conditions.push({ departmentId: user.departmentId });
  }
  if (user.roles.includes('DEPARTMENT_HEAD') || user.roles.includes('MANAGER')) {
    conditions.push({ responsibleId: user.id });
  }
  return conditions.length ? { OR: conditions } : { id: { in: [] } };
}
