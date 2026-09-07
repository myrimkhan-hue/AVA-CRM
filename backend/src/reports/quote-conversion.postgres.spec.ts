import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DealStage, PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Request, Response, NextFunction } from 'express';
import JSZip = require('jszip');
import { AuthUser } from '../auth/auth-user.type';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRatesService } from '../currencies/exchange-rates.service';
import { MarginService } from '../deals/margin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_SETTINGS_ID } from '../notifications/notifications.constants';
import { ReportsController } from './reports.controller';
import { ReportsExportService } from './reports-export.service';
import { ReportsService } from './reports.service';

// Real HTTP, DTO, role guard, report/export services and Prisma; only authentication
// is replaced. Every run migrates and removes its own isolated PostgreSQL schema.
describe('Quote conversion HTTP + PostgreSQL', () => {
  jest.setTimeout(120_000);
  const backendDir = resolve(__dirname, '../..');
  const schema = `quote_report_test_${randomUUID().replaceAll('-', '')}`;
  const users = new Map<string, AuthUser>();
  const period = 'from=2026-01-01&to=2026-01-31';
  let adminDb: PrismaClient;
  let schemaCreated = false;
  let prisma: PrismaService;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let legalEntityId: string;
  let clientId: string;
  let ownDepartment: string;
  let otherDepartment: string;
  let admin: AuthUser;
  let director: AuthUser;
  let head: AuthUser;
  let unscopedHead: AuthUser;
  let manager: AuthUser;
  let foreignManager: AuthUser;
  let logist: AuthUser;
  let financier: AuthUser;

  async function makeUser(role: string, departmentId: string | null, fullName = role) {
    const row = await prisma.user.create({
      data: {
        fullName, departmentId, email: `${randomUUID()}@example.invalid`,
        passwordHash: 'disabled-test-account',
        roles: { create: { role: { connect: { code: role } } } },
      },
    });
    const user: AuthUser = { ...row, roles: [role] };
    users.set(row.id, user);
    return user;
  }

  async function fixture(stage: DealStage, options: {
    departmentId?: string; draft?: boolean; withOption?: boolean;
    createdAt?: Date; deleted?: boolean;
  } = {}) {
    const foreign = options.departmentId === otherDepartment;
    const draft = options.draft ?? !['AGREED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'].includes(stage);
    return prisma.deal.create({
      data: {
        number: randomUUID(), legalEntityId, clientId,
        responsibleId: foreign ? foreignManager.id : manager.id,
        departmentId: options.departmentId ?? ownDepartment,
        stage, rejectReason: stage === 'REJECTED' ? 'EXPENSIVE' : null,
        createdAt: options.createdAt ?? new Date('2026-01-15T12:00:00Z'),
        deletedAt: options.deleted ? new Date() : null,
        transportations: { create: {
          number: randomUUID(), sequenceInDeal: 1, isQuoteDraft: draft,
          logistId: draft ? null : logist.id,
          originPoint: foreign ? 'Чужой маршрут' : 'Хоргос',
          destinationPoint: 'Алматы', transportMode: 'AUTO',
          quoteOptions: options.withOption === false ? undefined : { create: [
            { sequence: 1, isSelected: !draft, clientRate: 1500, clientRateCurrency: 'KZT', costRate: 1000, costRateCurrency: 'KZT' },
            { sequence: 2, clientRate: 99000, clientRateCurrency: 'KZT', costRate: 1, costRateCurrency: 'KZT' },
          ] },
        } },
      },
    });
  }

  async function http(user: AuthUser, query = period, suffix = '') {
    return fetch(`${baseUrl}/api/reports/quote-conversion${suffix}?${query}`, {
      headers: { 'x-test-user': user.id },
    });
  }

  beforeAll(async () => {
    for (const file of [resolve(backendDir, '.env'), resolve(backendDir, '../.env')]) {
      if (!process.env.DATABASE_URL && existsSync(file)) {
        process.env.DATABASE_URL = parseEnv(readFileSync(file, 'utf8')).DATABASE_URL;
      }
    }
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL integration tests');
    const url = new URL(process.env.DATABASE_URL);
    adminDb = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await adminDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    url.searchParams.set('schema', schema);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: backendDir, env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe', windowsHide: true, timeout: 90_000,
    });
    prisma = new PrismaService({ datasources: { db: { url: url.toString() } } });
    ownDepartment = (await prisma.department.create({ data: { name: 'Китай' } })).id;
    otherDepartment = (await prisma.department.create({ data: { name: 'Другой отдел' } })).id;
    await prisma.role.createMany({ data: ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST', 'FINANCIER'].map(
      (code) => ({ code, name: `Роль ${code}` }),
    ) });
    admin = await makeUser('ADMIN', null);
    director = await makeUser('DIRECTOR', null);
    head = await makeUser('DEPARTMENT_HEAD', ownDepartment);
    unscopedHead = await makeUser('DEPARTMENT_HEAD', null);
    manager = await makeUser('MANAGER', ownDepartment, 'Свой менеджер');
    foreignManager = await makeUser('MANAGER', otherDepartment, 'Чужой менеджер');
    logist = await makeUser('LOGIST', ownDepartment);
    financier = await makeUser('FINANCIER', null);
    legalEntityId = (await prisma.legalEntity.create({ data: { name: 'Тест AVA', numberingPrefix: 'AVA' } })).id;
    clientId = (await prisma.contractor.create({ data: { name: 'Тестовый клиент', types: ['CLIENT'] } })).id;
    for (const stage of ['AGREED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'] as DealStage[]) await fixture(stage);
    await fixture('REJECTED');
    await fixture('REJECTED');
    await fixture('NEW', { withOption: false });
    await fixture('RATE_CALCULATION');
    await fixture('RATE_SENT');
    await fixture('REJECTED', { departmentId: otherDepartment });
    await fixture('CLOSED', { draft: false, withOption: false }); // Ordinary deal, never a quote.
    await fixture('NEW', { draft: false, withOption: false });
    await fixture('CLOSED', { deleted: true });
    await fixture('CLOSED', { createdAt: new Date('2025-12-31T23:59:59Z') });
    await fixture('NEW', { withOption: false, createdAt: new Date('2026-02-01T00:00:00Z') });

    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [ReportsService, ReportsExportService, ExchangeRatesService, CurrenciesService, MarginService,
        { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request & { user?: AuthUser }, _res: Response, next: NextFunction) => {
      req.user = users.get(String(req.headers['x-test-user']));
      next();
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (adminDb) {
      try {
        if (schemaCreated) await adminDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      } finally { await adminDb.$disconnect(); }
    }
  });

  it.each(['MANAGER', 'LOGIST', 'FINANCIER'])('forbids %s on JSON and Excel', async (role) => {
    const actor = { MANAGER: manager, LOGIST: logist, FINANCIER: financier }[role]!;
    expect((await http(actor)).status).toBe(403);
    expect((await http(actor, period, '/export')).status).toBe(403);
  });

  it('counts promoted quotes in every won stage once and excludes ordinary deals', async () => {
    for (const actor of [admin, director]) {
      const response = await http(actor);
      expect(response.status).toBe(200);
      const report = await response.json();
      expect(report.summary).toEqual({
        total: 10, won: 4, lost: 3, inProgress: 3,
        conversionPercent: expect.closeTo(4 / 7 * 100, 1),
      });
      expect(report.byManager).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: manager.id, total: 9, won: 4, lost: 2, inProgress: 3 }),
        expect.objectContaining({ id: foreignManager.id, total: 1, won: 0, lost: 1 }),
      ]));
      expect(report.byLogist).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: null, total: 6, won: 0, lost: 3, inProgress: 3, conversionPercent: 0 }),
        expect.objectContaining({ id: logist.id, total: 4, won: 4, conversionPercent: 100 }),
      ]));
      expect(report.byDirection).toEqual(expect.arrayContaining([
        expect.objectContaining({ originPoint: 'Хоргос', destinationPoint: 'Алматы', total: 9, won: 4, lost: 2 }),
      ]));
      expect(report.byRejectReason).toEqual([
        { reason: 'EXPENSIVE', count: 3, sharePercent: 100 },
      ]);
    }
  });

  it('scopes department heads and lets administrators and directors select departments', async () => {
    const response = await http(head);
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.summary).toEqual({
      total: 9, won: 4, lost: 2, inProgress: 3,
      conversionPercent: expect.closeTo(4 / 6 * 100, 1),
    });
    expect(report.byManager).toHaveLength(1);
    expect(report.byManager[0].id).toBe(manager.id);
    expect(JSON.stringify(report)).not.toContain('Чужой');
    for (const actor of [admin, director]) {
      const filtered = await http(actor, `${period}&departmentId=${otherDepartment}`);
      expect(filtered.status).toBe(200);
      expect((await filtered.json()).summary).toEqual({ total: 1, won: 0, lost: 1, inProgress: 0, conversionPercent: 0 });
    }
  });

  it('applies identical department restrictions to JSON and Excel', async () => {
    for (const suffix of ['', '/export']) {
      expect((await http(head, `${period}&departmentId=${otherDepartment}`, suffix)).status).toBe(403);
      expect((await http(unscopedHead, period, suffix)).status).toBe(403);
    }
    const response = await http(head, period, '/export');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheetml');
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const sheets = await Promise.all(Object.keys(zip.files)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .map((name) => zip.file(name)!.async('string')));
    expect(sheets).toHaveLength(5);
    expect(sheets.join('')).toContain('Свой менеджер');
    expect(sheets.join('')).not.toContain('Чужой');
    expect(sheets.join('')).toContain('Не назначен');
  });

  it('returns zero conversion for unfinished requests and completely empty periods', async () => {
    for (const [query, total] of [
      ['from=2026-02-01&to=2026-02-28', 1],
      ['from=2026-03-01&to=2026-03-31', 0],
    ] as const) {
      const response = await http(admin, query);
      expect(response.status).toBe(200);
      expect((await response.json()).summary).toEqual({ total, won: 0, lost: 0, inProgress: total, conversionPercent: 0 });
    }
  });

  it('validates period DTOs on JSON and Excel paths', async () => {
    for (const suffix of ['', '/export']) {
      expect((await http(admin, 'from=not-a-date', suffix)).status).toBe(400);
      expect((await http(admin, 'from=2026-02-01&to=2026-01-01', suffix)).status).toBe(400);
    }
  });

  it('uses configured stalled days and the last stage event rather than deal edits', async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    await prisma.notificationSettings.upsert({
      where: { id: NOTIFICATION_SETTINGS_ID },
      create: { id: NOTIFICATION_SETTINGS_ID, dealStalledDays: 7 },
      update: { dealStalledDays: 7 },
    });
    for (const age of [10, 5]) {
      const deal = await fixture('RATE_SENT', { createdAt: new Date('2026-04-15T12:00:00Z') });
      await prisma.auditLog.create({ data: {
        entityType: 'Deal', entityId: deal.id, action: 'UPDATE',
        changes: { stage: { old: 'RATE_CALCULATION', new: 'RATE_SENT' } },
        createdAt: new Date(now - age * day),
      } });
      await prisma.auditLog.create({ data: {
        entityType: 'Deal', entityId: deal.id, action: 'UPDATE',
        changes: { notes: { old: null, new: 'Updated note' } },
        createdAt: new Date(now),
      } });
    }
    const response = await http(head, 'from=2026-04-01&to=2026-04-30');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ stalledDays: 7, stalledRateSentCount: 1 });
  });

  it('keeps financial reports inaccessible to department heads', async () => {
    const response = await fetch(`${baseUrl}/api/reports/dashboard?${period}`, { headers: { 'x-test-user': head.id } });
    expect(response.status).toBe(403);
  });
});
