import { Prisma } from '@prisma/client';

export async function allocateDealNumber(
  tx: Prisma.TransactionClient,
  legalEntity: { id: string; numberingPrefix: string },
): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await tx.dealNumberSequence.upsert({
    where: { legalEntityId_year: { legalEntityId: legalEntity.id, year } },
    create: { legalEntityId: legalEntity.id, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${legalEntity.numberingPrefix}-${year}-${String(sequence.lastNumber).padStart(4, '0')}`;
}
