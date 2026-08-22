import { ForbiddenException } from '@nestjs/common';
import { GeneratedDocumentType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';

function user(roles: string[], id = 'user-1'): AuthUser {
  return {
    id,
    fullName: 'Тестовый пользователь',
    email: 'test@ava.local',
    roles,
    departmentId: null,
  };
}

function journalRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    type: GeneratedDocumentType.CONTRACT,
    number: 'DOC-1',
    dealId: 'deal-1',
    transportationId: null,
    transportationLegId: null,
    invoiceId: null,
    contractorId: 'contractor-1',
    legalEntityId: 'legal-entity-1',
    generatedByUserId: 'author-1',
    generationData: null,
    generatedAt: new Date('2026-08-22T10:00:00.000Z'),
    ...overrides,
  };
}

describe('Права доступа: повторное скачивание из журнала документов', () => {
  const generatedDocument = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  };
  const deal = { findUnique: jest.fn() };
  const transportation = { findUnique: jest.fn() };
  const invoice = { findUnique: jest.fn() };
  const contractor = { findUnique: jest.fn() };
  const prisma = {
    generatedDocument,
    deal,
    transportation,
    invoice,
    contractor,
  } as unknown as PrismaService;
  const service = new DocumentsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    deal.findUnique.mockResolvedValue({ deletedAt: null });
    contractor.findUnique.mockResolvedValue({ deletedAt: null });
  });

  it('разрешает менеджеру скачать документ видимой сделки', async () => {
    const record = journalRecord();
    generatedDocument.findUnique.mockResolvedValue(record);
    generatedDocument.findFirst.mockResolvedValue({ id: record.id });

    await expect(service.findForDownload(record.id, user(['MANAGER'], 'manager')))
      .resolves.toBe(record);
    expect(generatedDocument.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: record.id },
          expect.objectContaining({ OR: expect.any(Array) }),
        ],
      },
      select: { id: true },
    });
  });

  it('запрещает менеджеру скачать документ чужой сделки', async () => {
    generatedDocument.findUnique.mockResolvedValue(journalRecord());
    generatedDocument.findFirst.mockResolvedValue(null);

    await expect(service.findForDownload('document-1', user(['MANAGER'], 'manager')))
      .rejects.toThrow(ForbiddenException);
  });

  it('запись без карточки-источника доступна только администратору и руководителю', async () => {
    const record = journalRecord({
      dealId: null,
      contractorId: null,
      legalEntityId: null,
    });
    generatedDocument.findUnique.mockResolvedValue(record);
    generatedDocument.findFirst.mockResolvedValue(null);

    await expect(service.findForDownload(record.id, user(['ADMIN'])))
      .resolves.toBe(record);
    await expect(service.findForDownload(record.id, user(['MANAGER'])))
      .rejects.toThrow(ForbiddenException);
  });

  it.each(['MANAGER', 'LOGIST'])(
    'разрешает роли %s скачать договор активного контрагента без сделки',
    async (role) => {
      const record = journalRecord({ dealId: null });
      generatedDocument.findUnique.mockResolvedValue(record);
      generatedDocument.findFirst.mockResolvedValue({ id: record.id });

      await expect(service.findForDownload(record.id, user([role])))
        .resolves.toBe(record);
      expect(contractor.findUnique).toHaveBeenCalledWith({
        where: { id: record.contractorId },
        select: { deletedAt: true },
      });
    },
  );

  it('не расширяет роли скачивания счёта для логиста', async () => {
    generatedDocument.findUnique.mockResolvedValue(journalRecord({
      type: GeneratedDocumentType.INVOICE,
      dealId: null,
      invoiceId: 'invoice-1',
    }));

    await expect(service.findForDownload('document-1', user(['LOGIST'])))
      .rejects.toThrow('Недостаточно прав для повторного скачивания документа');
    expect(invoice.findUnique).not.toHaveBeenCalled();
    expect(generatedDocument.findFirst).not.toHaveBeenCalled();
  });

  it('возвращает понятную ошибку, если карточка-источник удалена', async () => {
    generatedDocument.findUnique.mockResolvedValue(journalRecord());
    deal.findUnique.mockResolvedValue({ deletedAt: new Date() });

    await expect(service.findForDownload('document-1', user(['ADMIN'])))
      .rejects.toThrow('Карточка-источник документа удалена');
  });
});
