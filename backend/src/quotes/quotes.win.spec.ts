import { BadRequestException } from '@nestjs/common';
import { DealStage, Prisma, TransportMode } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { QuotesService } from './quotes.service';

const manager: AuthUser = {
  id: 'manager-1',
  fullName: 'Менеджер',
  email: 'manager@ava.local',
  roles: ['MANAGER'],
  departmentId: 'department-1',
};

function fixture() {
  const deal = {
    id: 'deal-1',
    number: 'AVA-2026-0001',
    legalEntityId: 'legal-1',
    clientId: 'client-1',
    responsibleId: manager.id,
    departmentId: manager.departmentId,
    stage: DealStage.RATE_SENT,
    rejectReason: 'PRICE_TOO_HIGH',
    rejectComment: 'Дорого',
    deletedAt: null,
    quoteRateDate: null,
    clientTargetRate: new Prisma.Decimal(1200),
    clientTargetRateCurrency: 'USD',
    client: { id: 'client-1', isProspect: true },
    legalEntity: { id: 'legal-1' },
    responsible: { id: manager.id, fullName: manager.fullName },
    department: { id: 'department-1' },
  };
  const option = {
    id: 'option-1',
    transportationId: 'quote-1',
    sequence: 1,
    vehicleType: 'Тент',
    carrierId: 'carrier-1',
    costRate: new Prisma.Decimal(900),
    costRateCurrency: 'USD',
    clientRate: new Prisma.Decimal(1200),
    clientRateCurrency: 'USD',
    isSelected: false,
    deletedAt: null,
    carrier: { id: 'carrier-1' },
  };
  const transportation = {
    id: 'quote-1',
    dealId: deal.id,
    number: 'Р-2026-0001',
    sequenceInDeal: 1,
    isQuoteDraft: true,
    deletedAt: null,
    originPoint: 'Алматы',
    destinationPoint: 'Астана',
    transportMode: TransportMode.AUTO,
    bodyType: null,
    clientRate: null,
    clientRateCurrency: null,
    deal,
    logist: { id: 'logist-1', fullName: 'Логист' },
    quoteOptions: [option],
  };
  const legs: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];

  const tx = {
    quoteOption: {
      updateMany: jest.fn(async () => {
        transportation.quoteOptions.forEach((item) => {
          item.isSelected = false;
        });
        return { count: transportation.quoteOptions.length };
      }),
      update: jest.fn(async ({ where, data }) => {
        const selected = transportation.quoteOptions.find(
          (item) => item.id === where.id,
        )!;
        Object.assign(selected, data);
        return selected;
      }),
    },
    transportation: {
      aggregate: jest.fn().mockResolvedValue({
        _max: { sequenceInDeal: null },
      }),
      updateMany: jest.fn(async ({ data }) => {
        if (!transportation.isQuoteDraft) return { count: 0 };
        Object.assign(transportation, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async () => transportation),
    },
    deal: {
      update: jest.fn(async ({ data }) => {
        Object.assign(deal, data);
        return deal;
      }),
    },
    contractor: {
      update: jest.fn(async ({ data }) => {
        Object.assign(deal.client, data);
        return deal.client;
      }),
    },
    transportationLeg: {
      create: jest.fn(async ({ data }) => {
        legs.push(data);
        return data;
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }) => {
        audits.push(data);
        return data;
      }),
    },
    contract: {
      findFirst: jest.fn().mockResolvedValue({ id: 'contract-1' }),
    },
  };
  const prisma = {
    transportation: {
      findUnique: jest.fn().mockResolvedValue({ id: transportation.id }),
      findFirst: jest.fn(async () => transportation),
    },
    $transaction: jest.fn(async (callback) => callback(tx)),
  };

  return { deal, transportation, option, legs, audits, prisma, tx };
}

describe('Выигрыш просчёта', () => {
  it('в одной Prisma-транзакции превращает просчёт в обычную перевозку', async () => {
    const state = fixture();
    const service = new QuotesService(state.prisma as never, {} as never);

    const result = await service.win(
      state.transportation.id,
      { optionId: state.option.id },
      manager,
    );

    expect(state.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(state.deal.stage).toBe(DealStage.AGREED);
    expect(state.deal.rejectReason).toBeNull();
    expect(state.deal.rejectComment).toBeNull();
    expect(state.deal.client.isProspect).toBe(false);
    expect(state.transportation.isQuoteDraft).toBe(false);
    expect(state.transportation.number).toBe('AVA-2026-0001/1');
    expect(String(state.transportation.clientRate)).toBe('1200');
    expect(state.transportation.clientRateCurrency).toBe('USD');
    expect(state.transportation.bodyType).toBe('Тент');
    expect(state.option.isSelected).toBe(true);
    expect(state.legs).toEqual([
      expect.objectContaining({
        transportationId: state.transportation.id,
        orderIndex: 1,
        fromPoint: 'Алматы',
        toPoint: 'Астана',
        subcontractorId: 'carrier-1',
        subcontractorRateCurrency: 'USD',
      }),
    ]);
    expect(state.audits).toHaveLength(1);
    expect(result.hasActiveContract).toBe(true);
  });

  it('отбивает повторный выигрыш', async () => {
    const state = fixture();
    const service = new QuotesService(state.prisma as never, {} as never);
    await service.win(state.transportation.id, { optionId: state.option.id }, manager);

    await expect(
      service.win(state.transportation.id, { optionId: state.option.id }, manager),
    ).rejects.toThrow(BadRequestException);
  });

  it('отбивает вариант из другого просчёта', async () => {
    const state = fixture();
    const service = new QuotesService(state.prisma as never, {} as never);

    await expect(
      service.win(state.transportation.id, { optionId: 'foreign-option' }, manager),
    ).rejects.toThrow('Выбранный вариант не принадлежит этому просчёту или удалён');
    expect(state.prisma.$transaction).not.toHaveBeenCalled();
  });
});
