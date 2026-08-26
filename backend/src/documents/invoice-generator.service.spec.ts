import { DocumentTemplateType, GeneratedDocumentType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { InvoiceGeneratorService } from './invoice-generator.service';

describe('InvoiceGeneratorService', () => {
  const invoicesService = { findOne: jest.fn() };
  const documentsService = {
    getLegalEntityParty: jest.fn(),
    getContractorParty: jest.fn(),
    findLatestContract: jest.fn(),
    logGeneration: jest.fn(),
  };
  const documentTemplatesService = { fillTemplate: jest.fn() };
  const user = { id: 'user-1', roles: ['ADMIN'] } as AuthUser;

  let service: InvoiceGeneratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoiceGeneratorService(
      invoicesService as never,
      documentsService as never,
      documentTemplatesService as never,
    );
    documentTemplatesService.fillTemplate.mockResolvedValue(Buffer.from('docx'));
    invoicesService.findOne.mockResolvedValue({
      id: 'invoice-1',
      number: 'AVA-25/08/2026',
      issueDate: new Date('2026-08-25T00:00:00.000Z'),
      legalEntityId: 'legal-1',
      clientId: 'client-1',
      transportationId: 'transportation-1',
      currency: { code: 'KZT' },
      lines: [
        {
          serviceName: 'Перевозка & погрузка',
          quantity: { toString: () => '2' },
          unitPrice: '1500',
          totalAmount: '3000',
        },
        {
          serviceName: 'Хранение',
          quantity: { toString: () => '1' },
          unitPrice: '1200.50',
          totalAmount: '1200.50',
        },
      ],
      totals: {
        netAmount: '3700.50',
        vatAmount: '500',
        totalAmount: '4200.50',
      },
    });
    documentsService.getLegalEntityParty.mockResolvedValue({
      id: 'legal-1',
      name: 'ТОО «AVA Solution»',
      bin: '123456789012',
      address: 'г. Алматы',
      account: 'KZ001234',
      bank: 'АО Банк',
      bik: 'BANKKZKX',
      kbe: '17',
      paymentPurposeCode: '710',
      signerShort: 'Иванов И.И.',
    });
    documentsService.getContractorParty.mockResolvedValue({
      id: 'client-1',
      name: 'ТОО Клиент',
      bin: '987654321098',
      address: 'г. Астана',
      phone: '+7 700 000 00 00',
    });
    documentsService.findLatestContract.mockResolvedValue({
      number: 'Д-42',
      generatedAt: new Date('2026-08-20T00:00:00.000Z'),
    });
  });

  it('fills the Word template, repeats service rows and logs initial generation', async () => {
    const result = await service.generate('invoice-1', user);

    expect(documentTemplatesService.fillTemplate).toHaveBeenCalledWith(
      DocumentTemplateType.INVOICE,
      expect.objectContaining({
        НОМЕР_СЧЕТА: 'AVA-25/08/2026',
        ДАТА_СЧЕТА: '25 августа 2026 г.',
        ПОСТАВЩИК_КБЕ: '17',
        ПОСТАВЩИК_КНП: '710',
        ДОГОВОР: '№ Д-42 от 20.08.2026',
        ВАЛЮТА: 'теңге',
        // Копейки не отбрасываются: 4200.50 -> "4 200,50", а не "4 200".
        ИТОГО: '4 200,50',
        НДС_СТРОКА: 'В том числе НДС: 500,00',
        КОЛИЧЕСТВО_НАИМЕНОВАНИЙ: 2,
        ВСЕГО_К_ОПЛАТЕ_ПРОПИСЬЮ:
          'Четыре тысячи двести теңге 50 тиын',
      }),
      {
        СТРОКА_УСЛУГИ: [
          {
            УСЛУГА_НОМЕР: 1,
            УСЛУГА_НАЗВАНИЕ: 'Перевозка & погрузка',
            УСЛУГА_КОЛИЧЕСТВО: '2,000',
            УСЛУГА_ЕДИНИЦА: 'усл.',
            УСЛУГА_ЦЕНА: '1 500,00',
            УСЛУГА_СУММА: '3 000,00',
          },
          {
            УСЛУГА_НОМЕР: 2,
            УСЛУГА_НАЗВАНИЕ: 'Хранение',
            УСЛУГА_КОЛИЧЕСТВО: '1,000',
            УСЛУГА_ЕДИНИЦА: 'усл.',
            УСЛУГА_ЦЕНА: '1 200,50',
            УСЛУГА_СУММА: '1 200,50',
          },
        ],
      },
    );
    expect(documentsService.logGeneration).toHaveBeenCalledWith({
      type: GeneratedDocumentType.INVOICE,
      number: 'AVA-25/08/2026',
      invoiceId: 'invoice-1',
      transportationId: 'transportation-1',
      contractorId: 'client-1',
      legalEntityId: 'legal-1',
      userId: 'user-1',
    });
    expect(result).toEqual({
      buffer: Buffer.from('docx'),
      filename: 'Счёт_AVA-25-08-2026_ТОО_Клиент.docx',
    });
  });

  it('uses the journal number without logging again and handles invoice without VAT or contract', async () => {
    invoicesService.findOne.mockResolvedValue({
      ...(await invoicesService.findOne('invoice-1', user)),
      currency: { code: 'USD' },
      totals: { netAmount: '4200', vatAmount: '0', totalAmount: '4200' },
    });
    documentsService.findLatestContract.mockResolvedValue(null);

    const result = await service.generate('invoice-1', user, 'Ж-7/2026');

    expect(documentTemplatesService.fillTemplate).toHaveBeenCalledWith(
      DocumentTemplateType.INVOICE,
      expect.objectContaining({
        НОМЕР_СЧЕТА: 'Ж-7/2026',
        ДОГОВОР: '—',
        НДС_СТРОКА: 'Без НДС',
        // Для валюты, отличной от тенге, прописью не пишем: словарь названий
        // валют в системе не ведётся, поэтому только цифрами и код валюты.
        ВАЛЮТА: 'USD',
        ВСЕГО_К_ОПЛАТЕ_ПРОПИСЬЮ: '4 200,00 USD',
      }),
      expect.any(Object),
    );
    expect(documentsService.logGeneration).not.toHaveBeenCalled();
    expect(result.filename).toBe('Счёт_Ж-7-2026_ТОО_Клиент.docx');
  });
});
