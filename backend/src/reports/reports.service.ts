import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentRequestStatus, Prisma } from '@prisma/client';
import { ExchangeRatesService } from '../currencies/exchange-rates.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashCalendarQueryDto } from './dto/cash-calendar-query.dto';

export interface ReceivableRow {
  invoiceId: string;
  invoiceNumber: string;
  transportationId: string;
  transportationNumber: string;
  clientId: string;
  clientName: string;
  legalEntityName: string;
  dueDate: string;
  balanceAmount: string;
  currencyCode: string;
  balanceKzt: number;
  isOverdue: boolean;
  daysOverdue: number;
}

export interface PayableRow {
  paymentRequestId: string;
  transportationId: string;
  transportationNumber: string;
  payeeId: string;
  payeeName: string;
  purpose: string;
  status: PaymentRequestStatus;
  dueDate: string;
  amount: string;
  currencyCode: string;
  amountKzt: number;
  isOverdue: boolean;
  daysOverdue: number;
}

export interface CashCalendarPeriod {
  periodStart: string;
  periodEnd: string;
  expectedIncomeKzt: number;
  expectedExpenseKzt: number;
  netKzt: number;
  runningBalanceKzt: number;
}

export interface CashCalendarResult {
  overdueIncomeKzt: number;
  overdueExpenseKzt: number;
  openingBalanceKzt: number;
  periods: CashCalendarPeriod[];
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async getReceivables(): Promise<ReceivableRow[]> {
    const today = this.today();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { not: InvoiceStatus.PAID },
        isIntragroup: false,
        transportation: { deletedAt: null, deal: { deletedAt: null } },
      },
      select: {
        id: true,
        number: true,
        currencyCode: true,
        dueDate: true,
        client: { select: { id: true, name: true } },
        legalEntity: { select: { name: true } },
        transportation: { select: { id: true, number: true } },
        lines: { select: { quantity: true, unitPrice: true, hasVat: true, vatRatePercent: true } },
        payments: { where: { deletedAt: null }, select: { amount: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const rateCache = new Map<string, number>();
    const rows: ReceivableRow[] = [];
    for (const invoice of invoices) {
      const totals = this.calculateGrossTotal(invoice.lines);
      const paid = invoice.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
      const balance = totals.minus(paid);
      if (balance.lessThanOrEqualTo(0.005)) continue;

      const rate = await this.rateToday(invoice.currencyCode, today, rateCache, `счёт ${invoice.number}`);
      const daysOverdue = this.daysOverdue(invoice.dueDate, today);
      rows.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        transportationId: invoice.transportation.id,
        transportationNumber: invoice.transportation.number,
        clientId: invoice.client.id,
        clientName: invoice.client.name,
        legalEntityName: invoice.legalEntity.name,
        dueDate: this.dateString(invoice.dueDate),
        balanceAmount: balance.toString(),
        currencyCode: invoice.currencyCode,
        balanceKzt: this.round2(balance.toNumber() * rate),
        isOverdue: daysOverdue > 0,
        daysOverdue,
      });
    }
    return rows;
  }

  async getPayables(): Promise<PayableRow[]> {
    const today = this.today();
    const requests = await this.prisma.paymentRequest.findMany({
      where: {
        deletedAt: null,
        status: { not: PaymentRequestStatus.PAID },
        transportation: { deletedAt: null, deal: { deletedAt: null } },
      },
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        dueDate: true,
        purpose: true,
        status: true,
        payeeContractor: { select: { id: true, name: true } },
        transportation: { select: { id: true, number: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const rateCache = new Map<string, number>();
    const rows: PayableRow[] = [];
    for (const request of requests) {
      const rate = await this.rateToday(request.currencyCode, today, rateCache, `заявка на оплату ${request.id}`);
      const daysOverdue = this.daysOverdue(request.dueDate, today);
      rows.push({
        paymentRequestId: request.id,
        transportationId: request.transportation.id,
        transportationNumber: request.transportation.number,
        payeeId: request.payeeContractor.id,
        payeeName: request.payeeContractor.name,
        purpose: request.purpose,
        status: request.status,
        dueDate: this.dateString(request.dueDate),
        amount: request.amount.toString(),
        currencyCode: request.currencyCode,
        amountKzt: this.round2(request.amount.toNumber() * rate),
        isOverdue: daysOverdue > 0,
        daysOverdue,
      });
    }
    return rows;
  }

  async getCashCalendar(query: CashCalendarQueryDto): Promise<CashCalendarResult> {
    const today = this.today();
    const from = query.from ? this.parseDate(query.from) : today;
    const to = query.to ? this.parseDate(query.to) : this.addDays(today, 30);
    if (to.getTime() < from.getTime()) {
      throw new BadRequestException('Дата окончания раньше даты начала');
    }
    const groupBy = query.groupBy ?? 'day';

    const [receivables, payables] = await Promise.all([this.getReceivables(), this.getPayables()]);

    const overdueIncomeKzt = this.round2(
      receivables.filter((row) => row.isOverdue).reduce((sum, row) => sum + row.balanceKzt, 0),
    );
    const overdueExpenseKzt = this.round2(
      payables.filter((row) => row.isOverdue).reduce((sum, row) => sum + row.amountKzt, 0),
    );
    const openingBalanceKzt = this.round2(overdueIncomeKzt - overdueExpenseKzt);

    const incomeByDate = this.sumByDate(receivables.filter((row) => !row.isOverdue), 'dueDate', 'balanceKzt');
    const expenseByDate = this.sumByDate(payables.filter((row) => !row.isOverdue), 'dueDate', 'amountKzt');

    const buckets = groupBy === 'week' ? this.weekBuckets(from, to) : this.dayBuckets(from, to);
    let runningBalance = openingBalanceKzt;
    const periods: CashCalendarPeriod[] = buckets.map(([start, end]) => {
      const income = this.sumInRange(incomeByDate, start, end);
      const expense = this.sumInRange(expenseByDate, start, end);
      const net = this.round2(income - expense);
      runningBalance = this.round2(runningBalance + net);
      return {
        periodStart: this.dateString(start),
        periodEnd: this.dateString(end),
        expectedIncomeKzt: this.round2(income),
        expectedExpenseKzt: this.round2(expense),
        netKzt: net,
        runningBalanceKzt: runningBalance,
      };
    });

    return { overdueIncomeKzt, overdueExpenseKzt, openingBalanceKzt, periods };
  }

  private calculateGrossTotal(
    lines: Array<{ quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; hasVat: boolean; vatRatePercent: Prisma.Decimal | null }>,
  ): Prisma.Decimal {
    return lines.reduce((total, line) => {
      const net = line.quantity.times(line.unitPrice).toDecimalPlaces(2);
      const vat = line.hasVat ? net.times(line.vatRatePercent ?? 0).dividedBy(100).toDecimalPlaces(2) : new Prisma.Decimal(0);
      return total.plus(net).plus(vat);
    }, new Prisma.Decimal(0));
  }

  private async rateToday(
    currencyCode: string,
    today: Date,
    cache: Map<string, number>,
    context: string,
  ): Promise<number> {
    if (cache.has(currencyCode)) return cache.get(currencyCode)!;
    const result = await this.exchangeRates.getRate(currencyCode, today);
    if (!result) {
      throw new BadRequestException(
        `Нет курса валюты ${currencyCode} на сегодня для отчёта (${context}). Подтяните курс НБ РК в разделе «Настройки → Валюты и курсы».`,
      );
    }
    const rate = result.rate.toNumber();
    cache.set(currencyCode, rate);
    return rate;
  }

  private sumByDate<T>(
    rows: T[],
    dateKey: keyof T,
    valueKey: keyof T,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      const date = row[dateKey] as string;
      const value = row[valueKey] as number;
      map.set(date, (map.get(date) ?? 0) + value);
    }
    return map;
  }

  private sumInRange(byDate: Map<string, number>, start: Date, end: Date): number {
    let sum = 0;
    for (const [dateStr, value] of byDate) {
      const date = this.parseDate(dateStr);
      if (date.getTime() >= start.getTime() && date.getTime() <= end.getTime()) sum += value;
    }
    return sum;
  }

  private dayBuckets(from: Date, to: Date): Array<[Date, Date]> {
    const buckets: Array<[Date, Date]> = [];
    let cursor = from;
    while (cursor.getTime() <= to.getTime()) {
      buckets.push([cursor, cursor]);
      cursor = this.addDays(cursor, 1);
    }
    return buckets;
  }

  private weekBuckets(from: Date, to: Date): Array<[Date, Date]> {
    const buckets: Array<[Date, Date]> = [];
    let cursor = from;
    while (cursor.getTime() <= to.getTime()) {
      const end = this.addDays(cursor, 6).getTime() > to.getTime() ? to : this.addDays(cursor, 6);
      buckets.push([cursor, end]);
      cursor = this.addDays(end, 1);
    }
    return buckets;
  }

  private daysOverdue(dueDate: Date, today: Date): number {
    const diff = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    return diff > 0 ? diff : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private parseDate(value: string): Date {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Дата указана неверно');
    return date;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private dateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
}
