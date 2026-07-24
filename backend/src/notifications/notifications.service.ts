import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DealStage, InvoiceStatus, NotificationType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import {
  DEFAULT_DEAL_STALLED_DAYS,
  NOTIFICATION_SETTINGS_ID,
} from './notifications.constants';
import { isDealStalled, isTransportationOverdue } from './notifications-rules';

const ALL_TYPES = Object.values(NotificationType);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: { userId: user.id, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(user: AuthUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, user: AuthUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!notification) throw new NotFoundException('Уведомление не найдено');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(user: AuthUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async getPreferences(user: AuthUser) {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId: user.id },
    });
    const byType = new Map(rows.map((row) => [row.type, row.enabled]));
    return ALL_TYPES.map((type) => ({ type, enabled: byType.get(type) ?? true }));
  }

  async setPreferences(user: AuthUser, dto: UpdateNotificationPreferencesDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type: { userId: user.id, type: item.type } },
          create: { userId: user.id, type: item.type, enabled: item.enabled },
          update: { enabled: item.enabled },
        }),
      ),
    );
    return this.getPreferences(user);
  }

  async getSettings() {
    return this.ensureSettings();
  }

  async updateSettings(dto: UpdateNotificationSettingsDto) {
    const settings = await this.ensureSettings();
    return this.prisma.notificationSettings.update({
      where: { id: settings.id },
      data: { dealStalledDays: dto.dealStalledDays },
    });
  }

  /** Событийное уведомление (назначение ответственного, новая заявка на оплату) — создаётся при каждом вызове. */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    if (!(await this.isEnabled(userId, type))) return;
    await this.prisma.notification.create({
      data: { userId, type, title, message, entityType, entityId },
    });
  }

  async notifyMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    await Promise.all(
      unique.map((userId) => this.notify(userId, type, title, message, entityType, entityId)),
    );
  }

  /**
   * Уведомление для фоновой проверки просрочек (cron): создаётся один раз на пару
   * пользователь+сущность — иначе каждый день копилась бы новая запись про одну и ту же просрочку.
   */
  async notifyOnce(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    if (!(await this.isEnabled(userId, type))) return;
    const existing = await this.prisma.notification.findFirst({
      where: { userId, type, entityId },
    });
    if (existing) return;
    await this.prisma.notification.create({
      data: { userId, type, title, message, entityType, entityId },
    });
  }

  @Cron('0 0 8 * * *', { timeZone: 'Asia/Almaty', waitForCompletion: true })
  async runDailyChecks(): Promise<void> {
    await this.checkOverdueTransportations().catch((error: unknown) =>
      this.logger.error('Ошибка проверки просроченных перевозок', error),
    );
    await this.checkOverdueInvoices().catch((error: unknown) =>
      this.logger.error('Ошибка проверки просроченных счетов', error),
    );
    await this.checkStalledDeals().catch((error: unknown) =>
      this.logger.error('Ошибка проверки зависших сделок', error),
    );
  }

  private async checkOverdueTransportations(): Promise<void> {
    const today = this.today();
    const candidates = await this.prisma.transportation.findMany({
      where: { deletedAt: null, plannedDeliveryDate: { not: null } },
      select: { id: true, number: true, logistId: true, status: true, plannedDeliveryDate: true },
    });
    for (const item of candidates) {
      if (!isTransportationOverdue(item.status, item.plannedDeliveryDate, today)) continue;
      await this.notifyOnce(
        item.logistId,
        NotificationType.TRANSPORTATION_OVERDUE,
        'Перевозка просрочена',
        `Перевозка ${item.number} просрочила плановую дату доставки`,
        'Transportation',
        item.id,
      );
    }
  }

  private async checkOverdueInvoices(): Promise<void> {
    const today = this.today();
    const overdue = await this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { not: InvoiceStatus.PAID },
        dueDate: { lt: today },
      },
      select: {
        id: true,
        number: true,
        transportationId: true,
        transportation: { select: { number: true, deal: { select: { responsibleId: true } } } },
      },
    });
    for (const invoice of overdue) {
      await this.notifyOnce(
        invoice.transportation.deal.responsibleId,
        NotificationType.INVOICE_OVERDUE,
        'Счёт просрочен',
        `Счёт ${invoice.number} по перевозке ${invoice.transportation.number} просрочен`,
        'Transportation',
        invoice.transportationId,
      );
    }
  }

  private async checkStalledDeals(): Promise<void> {
    const settings = await this.ensureSettings();
    const today = new Date();
    const candidates = await this.prisma.deal.findMany({
      where: { deletedAt: null, stage: DealStage.RATE_SENT },
      select: { id: true, number: true, responsibleId: true, createdAt: true },
    });
    for (const deal of candidates) {
      const logs = await this.prisma.auditLog.findMany({
        where: { entityType: 'Deal', entityId: deal.id },
        orderBy: { createdAt: 'desc' },
        select: { changes: true, createdAt: true },
      });
      const stageChange = logs.find(
        (log) => log.changes && typeof log.changes === 'object' && 'stage' in (log.changes as Record<string, unknown>),
      );
      const since = stageChange?.createdAt ?? deal.createdAt;
      if (!isDealStalled(since, today, settings.dealStalledDays)) continue;
      await this.notifyOnce(
        deal.responsibleId,
        NotificationType.DEAL_STALLED,
        'Сделка без движения',
        `Сделка ${deal.number} в стадии «Ставка отправлена» без движения больше ${settings.dealStalledDays} дн.`,
        'Deal',
        deal.id,
      );
    }
  }

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private async isEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    return preference ? preference.enabled : true;
  }

  private async ensureSettings() {
    const existing = await this.prisma.notificationSettings.findUnique({
      where: { id: NOTIFICATION_SETTINGS_ID },
    });
    if (existing) return existing;
    return this.prisma.notificationSettings.create({
      data: { id: NOTIFICATION_SETTINGS_ID, dealStalledDays: DEFAULT_DEAL_STALLED_DAYS },
    });
  }
}
