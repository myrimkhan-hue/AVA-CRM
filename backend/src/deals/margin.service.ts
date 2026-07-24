import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentRequestStatus, Prisma } from '@prisma/client';
import { ExchangeRatesService } from '../currencies/exchange-rates.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateDealMargin,
  DealMarginResult,
  MarginLineItem,
} from './margin-calculator';

@Injectable()
export class MarginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  /**
   * Маржа по набору перевозок (для карточки перевозки — один id;
   * для карточки сделки — все id перевозок сделки).
   */
  async calculateForTransportations(
    transportationIds: string[],
  ): Promise<DealMarginResult & { hasPlannedItems: boolean }> {
    if (transportationIds.length === 0) {
      return { ...calculateDealMargin({ items: [] }), hasPlannedItems: false };
    }

    const transportations = await this.prisma.transportation.findMany({
      where: { id: { in: transportationIds }, deletedAt: null },
      select: {
        id: true,
        createdAt: true,
        clientRate: true,
        clientRateCurrency: true,
        legs: {
          where: { subcontractorRate: { not: null } },
          select: { id: true, subcontractorRate: true, subcontractorRateCurrency: true },
        },
        invoices: {
          where: { deletedAt: null, isIntragroup: false },
          select: {
            id: true,
            currencyCode: true,
            lines: {
              select: {
                quantity: true,
                unitPrice: true,
                hasVat: true,
                vatRatePercent: true,
              },
            },
            payments: {
              where: { deletedAt: null },
              select: { id: true, amount: true, paymentDate: true, manualExchangeRate: true },
            },
          },
        },
        paymentRequests: {
          where: { deletedAt: null },
          select: {
            id: true,
            amount: true,
            currencyCode: true,
            status: true,
            paidAt: true,
            actualExchangeRate: true,
          },
        },
      },
    });

    const today = this.today();
    const rateCache = new Map<string, Prisma.Decimal | null>();
    const getRate = async (currencyCode: string, date: Date) => {
      const key = `${currencyCode}|${date.toISOString().slice(0, 10)}`;
      if (rateCache.has(key)) return rateCache.get(key)!;
      const result = await this.exchangeRates.getRate(currencyCode, date);
      const rate = result?.rate ?? null;
      rateCache.set(key, rate);
      return rate;
    };
    const requireRate = async (
      currencyCode: string,
      date: Date,
      context: string,
    ): Promise<number> => {
      const rate = await getRate(currencyCode, date);
      if (!rate) {
        throw new BadRequestException(
          `Нет курса валюты ${currencyCode} на дату ${date.toISOString().slice(0, 10)} для расчёта маржи (${context}). Подтяните курс НБ РК или задайте ручной курс в разделе «Настройки → Валюты и курсы».`,
        );
      }
      return rate.toNumber();
    };

    const items: MarginLineItem[] = [];
    let hasPlannedItems = false;

    for (const transportation of transportations) {
      const recordedDate = transportation.createdAt;

      if (transportation.invoices.length === 0) {
        if (transportation.clientRate && transportation.clientRateCurrency) {
          const rate = await requireRate(
            transportation.clientRateCurrency,
            today,
            `план по ставке клиента перевозки ${transportation.id}`,
          );
          items.push({
            id: `${transportation.id}-planned-income`,
            kind: 'INCOME',
            amount: transportation.clientRate.toNumber(),
            currencyCode: transportation.clientRateCurrency,
            isSettled: false,
            recordedRateToKzt: rate,
            settlementRateToKzt: rate,
          });
          hasPlannedItems = true;
        }
      }

      if (transportation.paymentRequests.length === 0) {
        for (const leg of transportation.legs) {
          if (!leg.subcontractorRate || !leg.subcontractorRateCurrency) continue;
          const rate = await requireRate(
            leg.subcontractorRateCurrency,
            today,
            `план по ставке перевозчика участка ${leg.id}`,
          );
          items.push({
            id: `${leg.id}-planned-expense`,
            kind: 'EXPENSE',
            amount: leg.subcontractorRate.toNumber(),
            currencyCode: leg.subcontractorRateCurrency,
            isSettled: false,
            recordedRateToKzt: rate,
            settlementRateToKzt: rate,
          });
          hasPlannedItems = true;
        }
      }

      for (const invoice of transportation.invoices) {
        const totals = this.calculateInvoiceTotals(invoice.lines);
        if (totals.netAmount.isZero() && totals.totalAmount.isZero()) continue;
        const vatRatio = totals.totalAmount.isZero()
          ? new Prisma.Decimal(1)
          : totals.netAmount.dividedBy(totals.totalAmount);

        const recordedRate = await requireRate(
          invoice.currencyCode,
          recordedDate,
          `счёт ${invoice.id}, курс на дату создания перевозки`,
        );

        let netPaidSoFar = new Prisma.Decimal(0);
        for (const payment of invoice.payments) {
          const netPortion = payment.amount.times(vatRatio);
          netPaidSoFar = netPaidSoFar.plus(netPortion);
          const settlementRate = payment.manualExchangeRate
            ? payment.manualExchangeRate.toNumber()
            : await requireRate(
                invoice.currencyCode,
                payment.paymentDate,
                `оплата ${payment.id} по счёту ${invoice.id}`,
              );
          items.push({
            id: payment.id,
            kind: 'INCOME',
            amount: netPortion.toNumber(),
            currencyCode: invoice.currencyCode,
            isSettled: true,
            recordedRateToKzt: recordedRate,
            settlementRateToKzt: settlementRate,
          });
        }

        const netRemaining = totals.netAmount.minus(netPaidSoFar);
        if (netRemaining.greaterThan(0.005)) {
          const forecastRate = await requireRate(
            invoice.currencyCode,
            today,
            `прогноз по счёту ${invoice.id}`,
          );
          items.push({
            id: `${invoice.id}-remaining`,
            kind: 'INCOME',
            amount: netRemaining.toNumber(),
            currencyCode: invoice.currencyCode,
            isSettled: false,
            recordedRateToKzt: recordedRate,
            settlementRateToKzt: forecastRate,
          });
        }
      }

      for (const request of transportation.paymentRequests) {
        const recordedRate = await requireRate(
          request.currencyCode,
          recordedDate,
          `заявка на оплату ${request.id}, курс на дату создания перевозки`,
        );
        const isSettled = request.status === PaymentRequestStatus.PAID;
        const settlementRate = isSettled
          ? request.actualExchangeRate
            ? request.actualExchangeRate.toNumber()
            : await requireRate(
                request.currencyCode,
                request.paidAt ?? today,
                `оплата заявки ${request.id}`,
              )
          : await requireRate(
              request.currencyCode,
              today,
              `прогноз по заявке ${request.id}`,
            );
        items.push({
          id: request.id,
          kind: 'EXPENSE',
          amount: request.amount.toNumber(),
          currencyCode: request.currencyCode,
          isSettled,
          recordedRateToKzt: recordedRate,
          settlementRateToKzt: settlementRate,
        });
      }
    }

    return { ...calculateDealMargin({ items }), hasPlannedItems };
  }

  private calculateInvoiceTotals(
    lines: Array<{
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      hasVat: boolean;
      vatRatePercent: Prisma.Decimal | null;
    }>,
  ) {
    return lines.reduce(
      (totals, line) => {
        const netAmount = line.quantity.times(line.unitPrice).toDecimalPlaces(2);
        const vatAmount = line.hasVat
          ? netAmount.times(line.vatRatePercent ?? 0).dividedBy(100).toDecimalPlaces(2)
          : new Prisma.Decimal(0);
        return {
          netAmount: totals.netAmount.plus(netAmount),
          totalAmount: totals.totalAmount.plus(netAmount).plus(vatAmount),
        };
      },
      { netAmount: new Prisma.Decimal(0), totalAmount: new Prisma.Decimal(0) },
    );
  }

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
