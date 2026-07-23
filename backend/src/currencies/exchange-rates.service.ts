import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AuditAction,
  Prisma,
  RateSource,
} from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateQueryDto } from './dto/exchange-rate-query.dto';
import { ManualExchangeRateDto } from './dto/manual-exchange-rate.dto';
import { CurrenciesService } from './currencies.service';

interface NbrkItem {
  title?: string;
  description?: string;
  quant?: string;
}

interface NbrkFeed {
  rates?: {
    date?: string;
    item?: NbrkItem | NbrkItem[];
  };
}

export interface FetchNbrkResult {
  requestedDate: string;
  publishedDate: string | null;
  received: number;
  saved: number;
  skippedManual: number;
  missingCurrencyCodes: string[];
}

type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly currenciesService: CurrenciesService,
  ) {}

  async findAll(query: ExchangeRateQueryDto) {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException(
        'Дата начала периода не может быть позже даты окончания',
      );
    }

    return this.prisma.exchangeRate.findMany({
      where: {
        ...(query.currencyCode
          ? { currencyCode: query.currencyCode }
          : {}),
        ...(query.from || query.to
          ? {
            rateDate: {
              ...(query.from ? { gte: this.toDate(query.from) } : {}),
              ...(query.to ? { lte: this.toDate(query.to) } : {}),
            },
          }
          : {}),
      },
      include: {
        currency: true,
        createdBy: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: [{ rateDate: 'desc' }, { currencyCode: 'asc' }],
    });
  }

  async setManualRate(dto: ManualExchangeRateDto, actorUserId: string) {
    const currency = await this.currenciesService.getByCode(dto.currencyCode);
    if (currency.isBase) {
      throw new BadRequestException(
        'Для базовой валюты KZT курс всегда равен 1',
      );
    }
    if (!currency.isActive) {
      throw new BadRequestException(
        'Нельзя задавать курс для неактивной валюты',
      );
    }

    const rateDate = this.toDate(dto.rateDate);
    const rate = new Prisma.Decimal(dto.rate);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.exchangeRate.findUnique({
        where: {
          currencyCode_rateDate: {
            currencyCode: currency.code,
            rateDate,
          },
        },
      });
      const saved = await tx.exchangeRate.upsert({
        where: {
          currencyCode_rateDate: {
            currencyCode: currency.code,
            rateDate,
          },
        },
        update: {
          rate,
          source: RateSource.MANUAL,
          createdByUserId: actorUserId,
          createdAt: new Date(),
        },
        create: {
          currencyCode: currency.code,
          rateDate,
          rate,
          source: RateSource.MANUAL,
          createdByUserId: actorUserId,
        },
      });
      await this.writeRateAudit(
        tx,
        actorUserId,
        current ? AuditAction.UPDATE : AuditAction.CREATE,
        current
          ? this.rateChanges(current, saved)
          : this.newRateChanges(saved),
        currency.code,
        rateDate,
      );
      return saved;
    });
  }

  async fetchNbrk(
    date: string,
    auditActorUserId: string | null = null,
  ): Promise<FetchNbrkResult> {
    const currencies = await this.prisma.currency.findMany({
      where: { isActive: true, isBase: false },
      orderBy: { code: 'asc' },
    });
    const feed = await this.loadNbrkFeed(date);
    const items = this.feedItems(feed);
    const byCode = new Map(
      items
        .map((item) => {
          const code = item.title?.trim().toUpperCase();
          return code ? [code, item] as const : null;
        })
        .filter((item): item is readonly [string, NbrkItem] => item !== null),
    );
    const result: FetchNbrkResult = {
      requestedDate: date,
      publishedDate: feed.rates?.date?.trim() || null,
      received: items.length,
      saved: 0,
      skippedManual: 0,
      missingCurrencyCodes: [],
    };

    if (!items.length) return result;

    const rateDate = this.toDate(date);
    await this.prisma.$transaction(async (tx) => {
      for (const currency of currencies) {
        const item = byCode.get(currency.code);
        if (!item) {
          result.missingCurrencyCodes.push(currency.code);
          continue;
        }
        const rate = this.parseNbrkRate(item, currency.code);
        let current = await tx.exchangeRate.findUnique({
          where: {
            currencyCode_rateDate: {
              currencyCode: currency.code,
              rateDate,
            },
          },
        });
        if (current?.source === RateSource.MANUAL) {
          result.skippedManual += 1;
          continue;
        }
        if (current && current.rate.equals(rate)) {
          continue;
        }

        const createdAt = new Date();
        if (!current) {
          const created = await tx.exchangeRate.createMany({
            data: [{
              currencyCode: currency.code,
              rateDate,
              rate,
              source: RateSource.NBRK_AUTO,
              createdByUserId: null,
              createdAt,
            }],
            skipDuplicates: true,
          });
          if (created.count) {
            await this.writeRateAudit(
              tx,
              auditActorUserId,
              AuditAction.CREATE,
              this.newRateChanges({
                currencyCode: currency.code,
                rateDate,
                rate,
                source: RateSource.NBRK_AUTO,
                createdByUserId: null,
              }),
              currency.code,
              rateDate,
            );
            result.saved += 1;
            continue;
          }
          current = await tx.exchangeRate.findUnique({
            where: {
              currencyCode_rateDate: {
                currencyCode: currency.code,
                rateDate,
              },
            },
          });
          if (current?.source === RateSource.MANUAL) {
            result.skippedManual += 1;
            continue;
          }
          if (!current || current.rate.equals(rate)) {
            continue;
          }
        }

        const updated = await tx.exchangeRate.updateMany({
          where: {
            currencyCode: currency.code,
            rateDate,
            source: RateSource.NBRK_AUTO,
          },
          data: {
            rate,
            createdByUserId: null,
            createdAt,
          },
        });
        if (!updated.count) {
          result.skippedManual += 1;
          continue;
        }
        const saved = {
          currencyCode: currency.code,
          rateDate,
          rate,
          source: RateSource.NBRK_AUTO,
          createdByUserId: null,
        };
        await this.writeRateAudit(
          tx,
          auditActorUserId,
          AuditAction.UPDATE,
          this.rateChanges(current, saved),
          currency.code,
          rateDate,
        );
        result.saved += 1;
      }
    });
    return result;
  }

  async getRate(
    currencyCode: string,
    date: Date,
  ): Promise<{
    rate: Prisma.Decimal;
    source: RateSource | null;
    rateDate: Date | null;
  } | null> {
    const currency = await this.prisma.currency.findUnique({
      where: { code: currencyCode.trim().toUpperCase() },
      select: { code: true, isBase: true },
    });
    if (!currency) return null;
    if (currency.isBase) {
      return {
        rate: new Prisma.Decimal(1),
        source: null,
        rateDate: null,
      };
    }

    return this.prisma.exchangeRate.findFirst({
      where: {
        currencyCode: currency.code,
        rateDate: { lte: date },
      },
      orderBy: { rateDate: 'desc' },
      select: { rate: true, source: true, rateDate: true },
    });
  }

  @Cron('0 0 16 * * *', {
    timeZone: 'Asia/Almaty',
    waitForCompletion: true,
  })
  async fetchDailyRates(): Promise<void> {
    const date = this.todayInAlmaty();
    try {
      const result = await this.fetchNbrk(date);
      this.logger.log(
        `НБ РК ${date}: сохранено ${result.saved}, ручных пропущено ${result.skippedManual}`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      this.logger.error(`Не удалось загрузить курсы НБ РК за ${date}: ${message}`);
    }
  }

  private async loadNbrkFeed(date: string): Promise<NbrkFeed> {
    const url = new URL('https://nationalbank.kz/rss/get_rates.cfm');
    url.searchParams.set('fdate', this.toNbrkDate(date));
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/xml, text/xml' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException(
        'Не удалось получить курсы с сайта НБ РК',
      );
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Сайт НБ РК вернул ошибку ${response.status}`,
      );
    }

    try {
      return this.parser.parse(await response.text()) as NbrkFeed;
    } catch {
      throw new BadGatewayException('Не удалось разобрать ответ НБ РК');
    }
  }

  private feedItems(feed: NbrkFeed): NbrkItem[] {
    const items = feed.rates?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
  }

  private parseNbrkRate(item: NbrkItem, code: string): Prisma.Decimal {
    const description = item.description?.replace(',', '.');
    const quant = item.quant?.replace(',', '.');
    try {
      const value = new Prisma.Decimal(description ?? '');
      const quantity = new Prisma.Decimal(quant ?? '');
      if (!value.isPositive() || !quantity.isPositive()) throw new Error();
      return value.dividedBy(quantity).toDecimalPlaces(6);
    } catch {
      throw new BadGatewayException(
        `НБ РК вернул некорректный курс для ${code}`,
      );
    }
  }

  private rateChanges(
    oldRate: {
      rate: Prisma.Decimal;
      source: RateSource;
      createdByUserId: string | null;
    },
    newRate: {
      rate: Prisma.Decimal;
      source: RateSource;
      createdByUserId: string | null;
    },
  ): Changes {
    return {
      rate: {
        old: oldRate.rate.toString(),
        new: newRate.rate.toString(),
      },
      source: { old: oldRate.source, new: newRate.source },
      createdByUserId: {
        old: oldRate.createdByUserId,
        new: newRate.createdByUserId,
      },
    };
  }

  private newRateChanges(rate: {
    currencyCode: string;
    rateDate: Date;
    rate: Prisma.Decimal;
    source: RateSource;
    createdByUserId: string | null;
  }): Changes {
    return {
      currencyCode: { old: null, new: rate.currencyCode },
      rateDate: { old: null, new: this.toDateOnly(rate.rateDate) },
      rate: { old: null, new: rate.rate.toString() },
      source: { old: null, new: rate.source },
      createdByUserId: { old: null, new: rate.createdByUserId },
    };
  }

  private async writeRateAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string | null,
    action: AuditAction,
    changes: Changes,
    currencyCode: string,
    rateDate: Date,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: 'ExchangeRate',
        entityId: `${currencyCode}:${this.toDateOnly(rateDate)}`,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }

  private toDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toNbrkDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}.${month}.${year}`;
  }

  private todayInAlmaty(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }
}
