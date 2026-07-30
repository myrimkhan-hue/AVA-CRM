import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';

/**
 * Кто какие счета видит (раздел 3 ТЗ). Счёт привязан к перевозке, поэтому
 * видимость наследуется от сделки этой перевозки: администратор, руководитель и
 * финансист — все счета; руководитель отдела — счета своего отдела; менеджер —
 * счета по своим сделкам. Логист счета не видит (в отличие от заявок на оплату).
 */
export function invoiceVisibilityWhere(user: AuthUser): Prisma.InvoiceWhereInput {
  if (user.roles.some((role) => ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role))) {
    return {};
  }
  const conditions: Prisma.TransportationWhereInput[] = [];
  if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
    conditions.push({ deal: { departmentId: user.departmentId } });
  }
  if (user.roles.includes('MANAGER')) {
    conditions.push({ deal: { responsibleId: user.id } });
  }
  return conditions.length
    ? { transportation: { is: { OR: conditions } } }
    : { id: { in: [] } };
}
