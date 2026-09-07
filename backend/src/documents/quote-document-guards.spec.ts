import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthUser } from '../auth/auth-user.type';
import { DealsService } from '../deals/deals.service';
import { ru } from '../locales/ru';
import { PrismaService } from '../prisma/prisma.service';
import { ContractGeneratorService } from './contract-generator.service';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentsService } from './documents.service';

describe('Документы по просчётам', () => {
  const user: AuthUser = {
    id: 'manager-1',
    fullName: 'Менеджер',
    email: 'manager@example.test',
    roles: ['MANAGER'],
    departmentId: null,
  };
  const prisma = {
    transportation: { findFirst: jest.fn() },
    contractor: { update: jest.fn() },
    documentNumberCounter: { upsert: jest.fn() },
    generatedDocument: { create: jest.fn() },
  };
  const deals = { findOne: jest.fn() };
  const templates = { fillTemplate: jest.fn() };
  let documents: DocumentsService;
  let contracts: ContractGeneratorService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DocumentsService,
        ContractGeneratorService,
        { provide: PrismaService, useValue: prisma },
        { provide: DealsService, useValue: deals },
        { provide: DocumentTemplatesService, useValue: templates },
      ],
    }).compile();
    documents = module.get(DocumentsService);
    contracts = module.get(ContractGeneratorService);
    deals.findOne.mockResolvedValue({
      id: 'deal-1',
      clientId: 'client-1',
      legalEntityId: 'legal-1',
      stage: 'NEW',
    });
  });

  it.each([undefined, 'EXISTING-1'])(
    'не формирует договор просчёта и не меняет реквизиты (существующий номер: %s)',
    async (existingNumber) => {
      prisma.transportation.findFirst.mockResolvedValue({ id: 'draft-1' });
      const overrides = jest.spyOn(documents, 'applyContractorOverrides');
      const legalParty = jest.spyOn(documents, 'getLegalEntityParty');
      const clientParty = jest.spyOn(documents, 'getContractorParty');

      await expect(
        contracts.generateForDeal(
          'deal-1',
          { legalAddress: 'Новый адрес' },
          user,
          existingNumber,
        ),
      ).rejects.toThrow(new BadRequestException(ru.quotes.documentsAfterWin));

      expect(deals.findOne).toHaveBeenCalledWith('deal-1', user);
      expect(prisma.transportation.findFirst).toHaveBeenCalledWith({
        where: { dealId: 'deal-1', isQuoteDraft: true, deletedAt: null },
        select: { id: true },
      });
      expect(overrides).not.toHaveBeenCalled();
      expect(legalParty).not.toHaveBeenCalled();
      expect(clientParty).not.toHaveBeenCalled();
      expect(prisma.contractor.update).not.toHaveBeenCalled();
      expect(prisma.documentNumberCounter.upsert).not.toHaveBeenCalled();
      expect(prisma.generatedDocument.create).not.toHaveBeenCalled();
      expect(templates.fillTemplate).not.toHaveBeenCalled();
    },
  );

  it('разрешает документы, если у сделки нет действующего черновика просчёта', async () => {
    prisma.transportation.findFirst.mockResolvedValue(null);

    await expect(documents.assertDealIsNotQuote('deal-1')).resolves.toBeUndefined();
  });
});
