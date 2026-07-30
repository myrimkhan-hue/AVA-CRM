import { Injectable } from '@nestjs/common';
import { CashCalendarQueryDto } from './dto/cash-calendar-query.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { buildXlsx, xlsxFileName, XlsxSheet } from './lib/build-xlsx';
import {
  CashCalendarPeriod,
  DashboardFinanceRow,
  PayableRow,
  ReceivableRow,
  ReportsService,
} from './reports.service';

export interface XlsxExport {
  buffer: Buffer;
  filename: string;
}

const TRANSPORTATION_STATUS_LABELS: Record<string, string> = {
  REQUEST_ACCEPTED: 'Заявка принята',
  CARGO_PICKED: 'Груз забран',
  IN_TRANSIT: 'В пути',
  CUSTOMS: 'Таможня',
  DELIVERED: 'Доставлен',
  CLOSED: 'Закрыта',
};

const DEAL_STAGE_LABELS: Record<string, string> = {
  NEW: 'Новая заявка',
  RATE_CALCULATION: 'Расчёт ставки',
  RATE_SENT: 'Ставка отправлена',
  AGREED: 'Согласована',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнена',
  CLOSED: 'Закрыта',
  REJECTED: 'Отказ',
};

const PAYMENT_REQUEST_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Заявлен',
  APPROVED: 'Согласован',
  PAID: 'Оплачен',
};

@Injectable()
export class ReportsExportService {
  constructor(private readonly reportsService: ReportsService) {}

  async exportReceivables(): Promise<XlsxExport> {
    const rows = await this.reportsService.getReceivables();
    const buffer = await buildXlsx([this.receivablesSheet(rows)]);
    return { buffer, filename: xlsxFileName('Дебиторка') };
  }

  async exportPayables(): Promise<XlsxExport> {
    const rows = await this.reportsService.getPayables();
    const buffer = await buildXlsx([this.payablesSheet(rows)]);
    return { buffer, filename: xlsxFileName('Кредиторка') };
  }

  async exportCashCalendar(query: CashCalendarQueryDto): Promise<XlsxExport> {
    const result = await this.reportsService.getCashCalendar(query);
    const buffer = await buildXlsx([
      {
        name: 'Кассовый календарь',
        columns: [
          {
            header: 'Период',
            value: (row: CashCalendarPeriod) =>
              row.periodStart === row.periodEnd
                ? this.toDate(row.periodStart)
                : `${row.periodStart} — ${row.periodEnd}`,
            type: query.groupBy === 'week' ? 'text' : 'date',
            width: 24,
          },
          { header: 'Ожидаемые поступления, KZT', value: (row: CashCalendarPeriod) => row.expectedIncomeKzt, type: 'money', width: 26 },
          { header: 'Обязательные платежи, KZT', value: (row: CashCalendarPeriod) => row.expectedExpenseKzt, type: 'money', width: 26 },
          { header: 'Разница, KZT', value: (row: CashCalendarPeriod) => row.netKzt, type: 'money', width: 18 },
          { header: 'Нарастающим итогом, KZT', value: (row: CashCalendarPeriod) => row.runningBalanceKzt, type: 'money', width: 24 },
        ],
        rows: result.periods,
      },
      {
        name: 'Просрочка',
        columns: [
          { header: 'Показатель', value: (row: { label: string }) => row.label, width: 32 },
          { header: 'Сумма, KZT', value: (row: { amount: number }) => row.amount, type: 'money', width: 20 },
        ],
        rows: [
          { label: 'Просроченные поступления', amount: result.overdueIncomeKzt },
          { label: 'Просроченные платежи', amount: result.overdueExpenseKzt },
          { label: 'Остаток по просрочке', amount: result.openingBalanceKzt },
        ],
      },
    ]);
    return { buffer, filename: xlsxFileName('Кассовый календарь') };
  }

  /** Дашборд выгружается одной книгой: каждый блок экрана — отдельный лист. */
  async exportDashboard(query: DashboardQueryDto): Promise<XlsxExport> {
    const dashboard = await this.reportsService.getDashboard(query);
    const [receivables, payables] = await Promise.all([
      this.reportsService.getReceivables(),
      this.reportsService.getPayables(),
    ]);

    const financeColumns = (labelHeader: string, labelKey: 'legalEntityName' | 'managerName') => [
      { header: labelHeader, value: (row: DashboardFinanceRow) => row[labelKey] ?? '', width: 32 },
      { header: 'Доходы, KZT', value: (row: DashboardFinanceRow) => row.incomeTotalKzt, type: 'money' as const, width: 20 },
      { header: 'Расходы, KZT', value: (row: DashboardFinanceRow) => row.expenseTotalKzt, type: 'money' as const, width: 20 },
      { header: 'Маржа, KZT', value: (row: DashboardFinanceRow) => row.marginKzt, type: 'money' as const, width: 20 },
      { header: 'Маржа, %', value: (row: DashboardFinanceRow) => row.marginPercent, type: 'number' as const, width: 14 },
    ];

    const buffer = await buildXlsx([
      {
        name: 'Сводка',
        columns: [
          { header: 'Показатель', value: (row: { label: string }) => row.label, width: 36 },
          { header: 'Значение', value: (row: { value: string | number }) => row.value, width: 24 },
        ],
        rows: [
          { label: 'Период с', value: dashboard.period.from },
          { label: 'Период по', value: dashboard.period.to },
          { label: 'Активные перевозки', value: dashboard.transportations.activeCount },
          { label: 'Заявок за период', value: dashboard.dealsFunnel.totalDeals },
          { label: 'Согласовано', value: dashboard.dealsFunnel.agreedCount },
          { label: 'Конверсия, %', value: dashboard.dealsFunnel.conversionPercent },
          { label: 'Доходы за период, KZT', value: dashboard.finance.total.incomeTotalKzt },
          { label: 'Расходы за период, KZT', value: dashboard.finance.total.expenseTotalKzt },
          { label: 'Маржа за период, KZT', value: dashboard.finance.total.marginKzt },
          {
            label: 'Маржа — прогноз или финальная',
            value: dashboard.finance.total.isForecast ? 'Прогноз' : 'Финальная',
          },
        ],
      },
      {
        name: 'Перевозки по статусам',
        columns: [
          { header: 'Статус', value: (row: { status: string }) => TRANSPORTATION_STATUS_LABELS[row.status] ?? row.status, width: 24 },
          { header: 'Количество', value: (row: { count: number }) => row.count, type: 'number', width: 16 },
        ],
        rows: dashboard.transportations.byStatus,
      },
      {
        name: 'Воронка сделок',
        columns: [
          { header: 'Стадия', value: (row: { stage: string }) => DEAL_STAGE_LABELS[row.stage] ?? row.stage, width: 24 },
          { header: 'Количество', value: (row: { count: number }) => row.count, type: 'number', width: 16 },
        ],
        rows: dashboard.dealsFunnel.byStage,
      },
      {
        name: 'Финансы по юрлицам',
        columns: financeColumns('Юрлицо', 'legalEntityName'),
        rows: dashboard.finance.byLegalEntity,
      },
      {
        name: 'Финансы по менеджерам',
        columns: financeColumns('Менеджер', 'managerName'),
        rows: dashboard.finance.byManager,
      },
      this.receivablesSheet(receivables),
      this.payablesSheet(payables),
      {
        name: 'Кассовый календарь',
        columns: [
          { header: 'Дата', value: (row: CashCalendarPeriod) => this.toDate(row.periodStart), type: 'date', width: 16 },
          { header: 'Ожидаемые поступления, KZT', value: (row: CashCalendarPeriod) => row.expectedIncomeKzt, type: 'money', width: 26 },
          { header: 'Обязательные платежи, KZT', value: (row: CashCalendarPeriod) => row.expectedExpenseKzt, type: 'money', width: 26 },
          { header: 'Нарастающим итогом, KZT', value: (row: CashCalendarPeriod) => row.runningBalanceKzt, type: 'money', width: 24 },
        ],
        rows: dashboard.cashCalendar.periods,
      },
    ]);
    return { buffer, filename: xlsxFileName('Дашборд') };
  }

  private receivablesSheet(rows: ReceivableRow[]): XlsxSheet<ReceivableRow> {
    return {
      name: 'Дебиторка',
      columns: [
        { header: 'Счёт', value: (row) => row.invoiceNumber, width: 20 },
        { header: 'Перевозка', value: (row) => row.transportationNumber, width: 20 },
        { header: 'Клиент', value: (row) => row.clientName, width: 32 },
        { header: 'Юрлицо', value: (row) => row.legalEntityName, width: 26 },
        { header: 'Долг', value: (row) => Number(row.balanceAmount), type: 'money', width: 18 },
        { header: 'Валюта', value: (row) => row.currencyCode, width: 12 },
        { header: 'Долг, KZT', value: (row) => row.balanceKzt, type: 'money', width: 20 },
        { header: 'Срок оплаты', value: (row) => this.toDate(row.dueDate), type: 'date', width: 16 },
        { header: 'Просрочка, дн.', value: (row) => row.daysOverdue, type: 'number', width: 16 },
      ],
      rows,
    };
  }

  private payablesSheet(rows: PayableRow[]): XlsxSheet<PayableRow> {
    return {
      name: 'Кредиторка',
      columns: [
        { header: 'Перевозка', value: (row) => row.transportationNumber, width: 20 },
        { header: 'Получатель', value: (row) => row.payeeName, width: 32 },
        { header: 'Назначение', value: (row) => row.purpose, width: 36 },
        { header: 'Статус', value: (row) => PAYMENT_REQUEST_STATUS_LABELS[row.status] ?? row.status, width: 18 },
        { header: 'Сумма', value: (row) => Number(row.amount), type: 'money', width: 18 },
        { header: 'Валюта', value: (row) => row.currencyCode, width: 12 },
        { header: 'Сумма, KZT', value: (row) => row.amountKzt, type: 'money', width: 20 },
        { header: 'Срок оплаты', value: (row) => this.toDate(row.dueDate), type: 'date', width: 16 },
        { header: 'Просрочка, дн.', value: (row) => row.daysOverdue, type: 'number', width: 16 },
      ],
      rows,
    };
  }

  /** Даты в отчётах хранятся строкой YYYY-MM-DD — в книгу кладём настоящей датой. */
  private toDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
