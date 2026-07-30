import { createHmac, timingSafeEqual } from 'crypto';
import { LeadStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';

/**
 * Кто какие лиды видит (раздел 4.9 ТЗ): администратор и руководитель — все;
 * руководитель отдела — лиды своего отдела; менеджер — только свои.
 * Финансисту и логисту лиды не видны.
 */
export function leadVisibilityWhere(user: AuthUser): Prisma.LeadWhereInput {
  if (user.roles.some((role) => ['ADMIN', 'DIRECTOR'].includes(role))) return {};
  const conditions: Prisma.LeadWhereInput[] = [];
  if (user.roles.includes('DEPARTMENT_HEAD') && user.departmentId) {
    conditions.push({ departmentId: user.departmentId });
  }
  if (user.roles.includes('MANAGER')) {
    conditions.push({ responsibleId: user.id });
  }
  return conditions.length ? { OR: conditions } : { id: { in: [] } };
}

/** Проверка подписи заявки с сайта (HMAC-SHA256 общим секретом, раздел 4.6.3 ТЗ). */
export function verifyWebsiteLeadSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !rawBody || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const providedBuffer = Buffer.from(signature.trim(), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/** Приводит телефон к последним 10 цифрам для сравнения — форматы ввода различаются (+7/8, пробелы, скобки). */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

/** Круговое распределение лидов между менеджерами поровну (лид 1 → менеджер 1, лид 2 → менеджер 2, ...). */
export function distributeRoundRobin(
  leadIds: string[],
  managerIds: string[],
): Array<{ leadId: string; responsibleId: string }> {
  return leadIds.map((leadId, index) => ({
    leadId,
    responsibleId: managerIds[index % managerIds.length],
  }));
}

interface CallQueueLead {
  status: LeadStatus;
  callBackAt: Date | null;
  createdAt: Date;
}

/** Ключ сортировки для «Моего обзвона»: просроченные/сегодняшние перезвоны — наверх, остальное — по дате перезвона/создания. */
export function callQueueSortKey(lead: CallQueueLead, today: Date): [number, number] {
  const isDueCallback =
    lead.status === LeadStatus.CALL_BACK && lead.callBackAt !== null && lead.callBackAt.getTime() <= today.getTime();
  const priority = isDueCallback ? 0 : 1;
  const secondary = (lead.callBackAt ?? lead.createdAt).getTime();
  return [priority, secondary];
}

export function compareCallQueue(a: CallQueueLead, b: CallQueueLead, today: Date): number {
  const [priorityA, secondaryA] = callQueueSortKey(a, today);
  const [priorityB, secondaryB] = callQueueSortKey(b, today);
  return priorityA - priorityB || secondaryA - secondaryB;
}
