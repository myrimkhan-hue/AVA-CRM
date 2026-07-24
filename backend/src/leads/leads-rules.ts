import { LeadStatus } from '@prisma/client';

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
