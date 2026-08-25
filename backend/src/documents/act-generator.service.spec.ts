import { BadRequestException } from '@nestjs/common';
import { DocumentTemplateType, GeneratedDocumentType, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import {
  ActGeneratorService,
  selectDealActDate,
  selectInvoiceActDate,
} from './act-generator.service';

describe('ActGeneratorService', () => {
  const invoicesService = { findOne: jest.fn(), findForDeal: jest.fn() };
  const dealsService = { findOne: jest.fn() };
  const prisma = {
    transportation: { findMany: jest.fn() },
    invoice: { count: jest.fn() },
  };
  const documentsService = {
    getLegalEntityParty: jest.fn(),
    getContractorParty: jest.fn(),
    findLatestContract: jest.fn(),
    nextDocumentNumber: jest.fn(),
    logGeneration: jest.fn(),
  };
  const documentTemplatesService = { fillTemplate: jest.fn() };
  const user = { id: 'user-1', roles: ['ADMIN'] } as AuthUser;
  let service: ActGeneratorService;

  const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'invoice-1',
    issueDate: new Date('2026-08-20T00:00:00.000Z'),
    legalEntityId: 'legal-1',
    clientId: 'client-1',
    transportationId: 'transportation-1',
    transportation: {
      unloadingEventDate: new Date('2026-08-24T00:00:00.000Z'),
    },
    currency: { code: 'KZT' },
    lines: [{
      serviceName: 'Перевозка',
      quantity: new Prisma.Decimal(1),
      unitPrice: new Prisma.Decimal(1000),
      totalAmount: new Prisma.Decimal(1120),
    }],
    totals: {
      totalAmount: new Prisma.Decimal(1120),
      vatAmount: new Prisma.Decimal(120),
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActGeneratorService(
      invoicesService as never,
      dealsService as never,
      prisma as never,
      documentsService as never,
      documentTemplatesService as never,
    );
    invoicesService.findOne.mockResolvedValue(invoice());
    invoicesService.findForDeal.mockResolvedValue([invoice()]);
    prisma.invoice.count.mockResolvedValue(1);
    dealsService.findOne.mockResolvedValue({
      id: 'deal-1',
      legalEntityId: 'legal-1',
      clientId: 'client-1',
    });
    prisma.transportation.findMany.mockResolvedValue([
      { unloadingEventDate: new Date('2026-08-22T00:00:00.000Z') },
      { unloadingEventDate: new Date('2026-08-25T00:00:00.000Z') },
    ]);
    documentsService.getLegalEntityParty.mockResolvedValue({
      id: 'legal-1',
      numberingPrefix: 'AVA',
      name: 'ТОО AVA',
      bin: '123',
      address: 'Алматы',
      account: 'KZ01',
      bank: 'Банк',
      bik: 'BIK',
      position: 'Директор',
      signerFull: 'Иванов Иван',
      signerShort: 'Иванов И.И.',
      basis: 'Устава',
      phone: '+7',
      email: 'ava@example.kz',
    });
    documentsService.getContractorParty.mockResolvedValue({
      id: 'client-1',
      name: 'ТОО Клиент',
      bin: '456',
      address: 'Астана',
      account: 'KZ02',
      bank: 'Другой банк',
      bik: 'BIK2',
      position: 'Директор',
      signerFull: 'Петров Пётр',
      signerShort: 'Петров П.П.',
      basis: 'Устава',
      phone: '+8',
      email: 'client@example.kz',
    });
    documentsService.findLatestContract.mockResolvedValue(null);
    documentsService.nextDocumentNumber.mockResolvedValue('AVA-AKT-2408/2026');
    documentTemplatesService.fillTemplate.mockResolvedValue(Buffer.from('docx'));
  });

  it('uses unloading date for an invoice act and logs invoice source links', async () => {
    const result = await service.generateForInvoice('invoice-1', user);

    expect(documentsService.nextDocumentNumber).toHaveBeenCalledWith(
      'AVA-AKT-2408/2026',
    );
    expect(documentTemplatesService.fillTemplate).toHaveBeenCalledWith(
      DocumentTemplateType.ACT,
      expect.objectContaining({
        НОМЕР_АКТА: 'AVA-AKT-2408/2026',
        ДАТА_АКТА: '24 августа 2026 г.',
        ИСПОЛНИТЕЛЬ_НАЗВАНИЕ: 'ТОО AVA',
        ЗАКАЗЧИК_НАЗВАНИЕ: 'ТОО Клиент',
        ИТОГО: '1 120',
        НДС_СТРОКА: 'В том числе НДС: 120 KZT',
      }),
      {
        СТРОКА_УСЛУГИ: [expect.objectContaining({
          УСЛУГА_НАЗВАНИЕ: 'Перевозка',
          УСЛУГА_СУММА: '1 120',
        })],
      },
    );
    expect(documentsService.logGeneration).toHaveBeenCalledWith({
      type: GeneratedDocumentType.ACT,
      number: 'AVA-AKT-2408/2026',
      invoiceId: 'invoice-1',
      transportationId: 'transportation-1',
      dealId: undefined,
      contractorId: 'client-1',
      legalEntityId: 'legal-1',
      userId: 'user-1',
    });
    expect(result.filename).toBe('Акт_AVA-AKT-2408-2026_ТОО_Клиент.docx');
  });

  it('uses the latest unloading date among all deal transportations', async () => {
    documentsService.nextDocumentNumber.mockResolvedValue('AVA-AKT-2508/2026');

    await service.generateForDeal('deal-1', user);

    expect(prisma.transportation.findMany).toHaveBeenCalledWith({
      where: { dealId: 'deal-1', deletedAt: null },
      select: { unloadingEventDate: true },
    });
    expect(documentsService.nextDocumentNumber).toHaveBeenCalledWith(
      'AVA-AKT-2508/2026',
    );
    expect(documentTemplatesService.fillTemplate).toHaveBeenCalledWith(
      DocumentTemplateType.ACT,
      expect.objectContaining({ ДАТА_АКТА: '25 августа 2026 г.' }),
      expect.any(Object),
    );
    expect(documentsService.logGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        type: GeneratedDocumentType.ACT,
        dealId: 'deal-1',
        invoiceId: undefined,
        transportationId: undefined,
      }),
    );
  });

  it('keeps the journal number on repeat download without a counter increment or new log', async () => {
    const result = await service.generateForInvoice(
      'invoice-1',
      user,
      'AVA-AKT-2408/2026/3',
    );

    expect(documentsService.nextDocumentNumber).not.toHaveBeenCalled();
    expect(documentsService.logGeneration).not.toHaveBeenCalled();
    expect(documentTemplatesService.fillTemplate).toHaveBeenCalledWith(
      DocumentTemplateType.ACT,
      expect.objectContaining({ НОМЕР_АКТА: 'AVA-AKT-2408/2026/3' }),
      expect.any(Object),
    );
    expect(result.filename).toBe(
      'Акт_AVA-AKT-2408-2026-3_ТОО_Клиент.docx',
    );
  });

  it('rejects a deal without invoices', async () => {
    invoicesService.findForDeal.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(0);

    await expect(service.generateForDeal('deal-1', user)).rejects.toThrow(
      new BadRequestException('По сделке ещё нет счетов, акт формировать не из чего'),
    );
    expect(documentTemplatesService.fillTemplate).not.toHaveBeenCalled();
  });

  it('rejects a combined act when some deal invoices are invisible to the user', async () => {
    // Руководитель отдела видит сделку, где он ответственный, но счета по ней
    // может не видеть: собранный из доступной части акт был бы неполным.
    invoicesService.findForDeal.mockResolvedValue([invoice()]);
    prisma.invoice.count.mockResolvedValue(3);

    await expect(service.generateForDeal('deal-1', user)).rejects.toThrow(
      /недоступна/,
    );
    expect(documentTemplatesService.fillTemplate).not.toHaveBeenCalled();
  });

  it('rejects a combined act for invoices in different currencies', async () => {
    invoicesService.findForDeal.mockResolvedValue([
      invoice(),
      invoice({ id: 'invoice-2', currency: { code: 'USD' } }),
    ]);
    prisma.invoice.count.mockResolvedValue(2);

    await expect(service.generateForDeal('deal-1', user)).rejects.toThrow(
      new BadRequestException(
        'Сводный акт по счетам в разных валютах сформировать нельзя',
      ),
    );
    expect(documentTemplatesService.fillTemplate).not.toHaveBeenCalled();
  });
});

describe('act date selection', () => {
  it('falls back from missing invoice unloading date to issue date', () => {
    const issueDate = new Date('2026-08-20T00:00:00.000Z');
    expect(selectInvoiceActDate(null, issueDate)).toBe(issueDate);
  });

  it('falls back from missing deal unloading dates to the current date', () => {
    const currentDate = new Date('2026-08-25T00:00:00.000Z');
    expect(selectDealActDate([null, undefined], currentDate)).toBe(currentDate);
  });
});
