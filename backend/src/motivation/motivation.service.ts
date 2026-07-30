import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { MarginService } from '../deals/margin.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildXlsx, xlsxFileName } from '../reports/lib/build-xlsx';
import { UpdateMotivationSettingsDto } from './dto/update-motivation-settings.dto';
import { DEFAULT_MOTIVATION_RATE_PERCENT, MOTIVATION_SETTINGS_ID } from './motivation.constants';

type PaymentStatusBadge = 'full' | 'part' | 'none';

const MOTIVATION_PAYMENT_LABELS: Record<PaymentStatusBadge, string> = {
  full: 'Оплачен полностью',
  part: 'Оплачен частично',
  none: 'Не оплачен',
};

export interface MotivationRow {
  transportationId: string;
  number: string;
  clientName: string;
  route: string;
  unloadingDate: string;
  marginKzt: number;
  isForecast: boolean;
  paymentStatus: PaymentStatusBadge;
}

export interface EmployeeMotivationReport {
  userId: string;
  fullName: string;
  ratePercent: number;
  rows: MotivationRow[];
  totalMarginKzt: number;
  totalBonusKzt: number;
}

@Injectable()
export class MotivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marginService: MarginService,
  ) {}

  async getSettings() {
    return this.ensureSettings();
  }

  async updateSettings(dto: UpdateMotivationSettingsDto) {
    const settings = await this.ensureSettings();
    return this.prisma.motivationSettings.update({
      where: { id: settings.id },
      data: { bonusRatePercent: new Prisma.Decimal(dto.bonusRatePercent) },
    });
  }

  async getMyReport(user: AuthUser, month?: string) {
    const range = this.monthRange(month);
    const [report] = await this.buildReports([user.id], range);
    return report ?? this.emptyReport(user.id, user.fullName, await this.rateForUser(user.id));
  }

  async getSummaryReport(user: AuthUser, month?: string) {
    const range = this.monthRange(month);
    const isCompanyWide = user.roles.some((role) =>
      ['ADMIN', 'DIRECTOR', 'FINANCIER'].includes(role),
    );
    const isDepartmentHead = user.roles.includes('DEPARTMENT_HEAD');
    if (!isCompanyWide && !isDepartmentHead) {
      throw new ForbiddenException(
        'Сводный отчёт по мотивации доступен только руководителю отдела, руководителю, финансисту и администратору',
      );
    }
    if (!isCompanyWide && !user.departmentId) return [];
    const employees = await this.prisma.user.findMany({
      where: {
        isActive: true,
        departmentId: isCompanyWide ? undefined : user.departmentId,
        roles: { some: { role: { code: { in: ['MANAGER', 'DEPARTMENT_HEAD', 'LOGIST'] } } } },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
    const reports = await this.buildReports(employees.map((employee) => employee.id), range);
    return reports.filter((report) => report.rows.length > 0);
  }

  /**
   * Сводный отчёт по мотивации книгой Excel: лист «Итого по сотрудникам» и
   * лист с построчной расшифровкой по перевозкам. Права проверяет getSummaryReport.
   */
  async exportSummaryReport(user: AuthUser, month?: string) {
    const reports = await this.getSummaryReport(user, month);
    const period = month ?? this.currentMonth();

    const details = reports.flatMap((report) =>
      report.rows.map((row) => ({ employee: report.fullName, ...row })),
    );

    const buffer = await buildXlsx([
      {
        name: 'Итого по сотрудникам',
        columns: [
          { header: 'Сотрудник', value: (row: EmployeeMotivationReport) => row.fullName, width: 32 },
          { header: 'Ставка бонуса, %', value: (row: EmployeeMotivationReport) => row.ratePercent, type: 'number', width: 18 },
          { header: 'Перевозок', value: (row: EmployeeMotivationReport) => row.rows.length, type: 'number', width: 14 },
          { header: 'Маржа, KZT', value: (row: EmployeeMotivationReport) => row.totalMarginKzt, type: 'money', width: 20 },
          { header: 'Бонус, KZT', value: (row: EmployeeMotivationReport) => row.totalBonusKzt, type: 'money', width: 20 },
        ],
        rows: reports,
      },
      {
        name: 'Расшифровка',
        columns: [
          { header: 'Сотрудник', value: (row: MotivationRow & { employee: string }) => row.employee, width: 32 },
          { header: 'Перевозка', value: (row: MotivationRow) => row.number, width: 20 },
          { header: 'Клиент', value: (row: MotivationRow) => row.clientName, width: 32 },
          { header: 'Маршрут', value: (row: MotivationRow) => row.route, width: 36 },
          {
            header: 'Дата выгрузки',
            value: (row: MotivationRow) => new Date(`${row.unloadingDate}T00:00:00.000Z`),
            type: 'date',
            width: 16,
          },
          { header: 'Маржа, KZT', value: (row: MotivationRow) => row.marginKzt, type: 'money', width: 20 },
          { header: 'Маржа', value: (row: MotivationRow) => (row.isForecast ? 'Прогноз' : 'Финальная'), width: 16 },
          {
            header: 'Оплата клиента',
            value: (row: MotivationRow) => MOTIVATION_PAYMENT_LABELS[row.paymentStatus],
            width: 20,
          },
        ],
        rows: details,
      },
    ]);

    return { buffer, filename: xlsxFileName(`Мотивация ${period}`) };
  }

  private async buildReports(
    userIds: string[],
    range: { start: Date; end: Date },
  ): Promise<EmployeeMotivationReport[]> {
    if (userIds.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, motivationRatePercent: true },
    });
    if (users.length === 0) return [];
    const settings = await this.ensureSettings();

    const transportations = await this.prisma.transportation.findMany({
      where: {
        deletedAt: null,
        deal: { deletedAt: null },
        unloadingEventDate: { gte: range.start, lte: range.end },
        OR: [
          { logistId: { in: userIds } },
          { deal: { responsibleId: { in: userIds } } },
        ],
      },
      select: {
        id: true,
        number: true,
        originPoint: true,
        destinationPoint: true,
        unloadingEventDate: true,
        logistId: true,
        deal: {
          select: { responsibleId: true, client: { select: { name: true } } },
        },
        invoices: {
          where: { deletedAt: null, isIntragroup: false },
          take: 1,
          select: { status: true },
        },
      },
      orderBy: { unloadingEventDate: 'asc' },
    });

    const margins = await Promise.all(
      transportations.map((transportation) =>
        this.marginService.calculateForTransportations([transportation.id]),
      ),
    );

    const reportsByUser = new Map<string, EmployeeMotivationReport>();
    for (const employee of users) {
      reportsByUser.set(
        employee.id,
        this.emptyReport(
          employee.id,
          employee.fullName,
          employee.motivationRatePercent
            ? employee.motivationRatePercent.toNumber()
            : settings.bonusRatePercent.toNumber(),
        ),
      );
    }

    transportations.forEach((transportation, index) => {
      const margin = margins[index];
      const associatedUserIds = new Set(
        [transportation.logistId, transportation.deal.responsibleId].filter((id) =>
          userIds.includes(id),
        ),
      );
      const row: MotivationRow = {
        transportationId: transportation.id,
        number: transportation.number,
        clientName: transportation.deal.client.name,
        route: `${transportation.originPoint} — ${transportation.destinationPoint}`,
        unloadingDate: this.dateString(transportation.unloadingEventDate!),
        marginKzt: margin.marginKzt,
        isForecast: margin.isForecast,
        paymentStatus: this.paymentStatus(transportation.invoices[0]?.status),
      };
      for (const userId of associatedUserIds) {
        const report = reportsByUser.get(userId);
        if (!report) continue;
        report.rows.push(row);
      }
    });

    for (const report of reportsByUser.values()) {
      report.totalMarginKzt = this.round2(
        report.rows.reduce((sum, row) => sum + row.marginKzt, 0),
      );
      report.totalBonusKzt = this.round2(report.totalMarginKzt * report.ratePercent / 100);
    }

    return userIds.map((id) => reportsByUser.get(id)).filter((report): report is EmployeeMotivationReport => Boolean(report));
  }

  private emptyReport(userId: string, fullName: string, ratePercent: number): EmployeeMotivationReport {
    return { userId, fullName, ratePercent, rows: [], totalMarginKzt: 0, totalBonusKzt: 0 };
  }

  private async rateForUser(userId: string): Promise<number> {
    const [user, settings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { motivationRatePercent: true } }),
      this.ensureSettings(),
    ]);
    return user?.motivationRatePercent
      ? user.motivationRatePercent.toNumber()
      : settings.bonusRatePercent.toNumber();
  }

  private paymentStatus(status: InvoiceStatus | undefined): PaymentStatusBadge {
    if (status === InvoiceStatus.PAID) return 'full';
    if (status === InvoiceStatus.PARTIALLY_PAID) return 'part';
    return 'none';
  }

  private async ensureSettings() {
    const existing = await this.prisma.motivationSettings.findUnique({
      where: { id: MOTIVATION_SETTINGS_ID },
    });
    if (existing) return existing;
    return this.prisma.motivationSettings.create({
      data: { id: MOTIVATION_SETTINGS_ID, bonusRatePercent: DEFAULT_MOTIVATION_RATE_PERCENT },
    });
  }

  private monthRange(month?: string): { start: Date; end: Date } {
    const value = month ?? this.currentMonth();
    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new BadRequestException('Месяц должен быть в формате YYYY-MM');
    }
    const [year, monthNumber] = value.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1));
    const end = new Date(Date.UTC(year, monthNumber, 0));
    return { start, end };
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private dateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
