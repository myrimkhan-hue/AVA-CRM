import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExchangeRatesService } from '../currencies/exchange-rates.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

interface QuoteResponse {
  id: string;
  number: string;
  dealId: string;
  logistId: string | null;
  isQuoteDraft: boolean;
  deal: { number: string; departmentId: string | null };
  quoteOptions: { id: string }[];
}

// Full HTTP/DTO/policy/service/Prisma path. Each run owns a fresh schema;
// migrations, fixtures and cleanup never touch the application's schema.
describe('Quotes HTTP + PostgreSQL', () => {
  jest.setTimeout(120_000);
  const backendDir = resolve(__dirname, '../..');
  const schema = `quotes_test_${randomUUID().replaceAll('-', '')}`;
  const users = new Map<string, AuthUser>();
  let adminDb: PrismaClient;
  let schemaCreated = false;
  let prisma: PrismaService;
  let app: INestApplication | undefined;
  let baseUrl: string;
  let legalEntityId: string;
  let clientId: string;
  let ownDepartment: string;
  let otherDepartment: string;
  let manager: AuthUser;
  let admin: AuthUser;
  let logist: AuthUser;
  let secondLogist: AuthUser;
  let otherLogist: AuthUser;
  let noDepartmentLogist: AuthUser;
  let head: AuthUser;
  let director: AuthUser;
  let financier: AuthUser;
  const year = new Date().getFullYear();
  const sequenceWhere = () => ({ legalEntityId_year: { legalEntityId, year } });

  async function makeUser(role: string, departmentId: string | null) {
    const user = await prisma.user.create({
      data: {
        fullName: `Тест ${role}`,
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'disabled-test-account',
        departmentId,
        roles: { create: { role: { connect: { code: role } } } },
      },
    });
    const auth: AuthUser = { ...user, roles: [role] };
    users.set(user.id, auth);
    return auth;
  }

  async function http(method: string, path: string, user: AuthUser, body?: object) {
    return fetch(`${baseUrl}/api/quotes${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-test-user': user.id },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function createQuote(extra: object = {}): Promise<QuoteResponse> {
    const response = await http('POST', '', manager, {
      legalEntityId,
      clientId,
      originPoint: 'Хоргос',
      destinationPoint: 'Алматы',
      transportMode: 'AUTO',
      ...extra,
    });
    const body = await response.json();
    expect({ status: response.status, body }).toMatchObject({ status: 201 });
    return body as QuoteResponse;
  }

  beforeAll(async () => {
    for (const envFile of [resolve(backendDir, '.env'), resolve(backendDir, '../.env')]) {
      if (!process.env.DATABASE_URL && existsSync(envFile)) {
        process.env.DATABASE_URL = parseEnv(readFileSync(envFile, 'utf8')).DATABASE_URL;
      }
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for PostgreSQL integration tests');
    }
    const url = new URL(process.env.DATABASE_URL);
    adminDb = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await adminDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    url.searchParams.set('schema', schema);
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
      windowsHide: true,
      timeout: 90_000,
    });
    prisma = new PrismaService({ datasources: { db: { url: url.toString() } } });
    ownDepartment = (await prisma.department.create({ data: { name: 'Китай' } })).id;
    otherDepartment = (await prisma.department.create({ data: { name: 'РК/РФ' } })).id;
    await prisma.role.createMany({
      data: ['ADMIN', 'MANAGER', 'LOGIST', 'DEPARTMENT_HEAD', 'DIRECTOR', 'FINANCIER'].map(
        (code) => ({ code, name: `Роль ${code}` }),
      ),
    });
    manager = await makeUser('MANAGER', ownDepartment);
    admin = await makeUser('ADMIN', null);
    logist = await makeUser('LOGIST', ownDepartment);
    secondLogist = await makeUser('LOGIST', ownDepartment);
    otherLogist = await makeUser('LOGIST', otherDepartment);
    noDepartmentLogist = await makeUser('LOGIST', null);
    head = await makeUser('DEPARTMENT_HEAD', ownDepartment);
    director = await makeUser('DIRECTOR', null);
    financier = await makeUser('FINANCIER', null);
    legalEntityId = (await prisma.legalEntity.create({
      data: { name: 'Тест AVA', numberingPrefix: 'AVA' },
    })).id;
    clientId = (await prisma.contractor.create({
      data: { name: 'Тестовый клиент', types: ['CLIENT'] },
    })).id;

    const module = await Test.createTestingModule({
      controllers: [QuotesController],
      providers: [
        QuotesService,
        ExchangeRatesService,
        CurrenciesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication();
    // Authentication alone is replaced with fixture users; real role guards remain.
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
        if (schemaCreated) {
          await adminDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
        }
      } finally {
        await adminDb.$disconnect();
      }
    }
  });

  it('creates without a logist or deal sequence, using the same Cyrillic quote number', async () => {
    expect(await prisma.dealNumberSequence.findUnique({ where: sequenceWhere() })).toBeNull();
    const quote = await createQuote();
    expect(quote.logistId).toBeNull();
    expect(quote.deal.number).toBe(quote.number);
    expect(quote.number).toBe(`Р-${year}-0001`);
    expect(await prisma.dealNumberSequence.findUnique({ where: sequenceWhere() })).toBeNull();
    expect(await prisma.quoteNumberSequence.findUnique({ where: sequenceWhere() })).toMatchObject({ lastNumber: 1 });
  });

  it('rejects win without a logist, then accepts PATCH assignment and allocates exactly one deal number', async () => {
    await prisma.dealNumberSequence.create({ data: { legalEntityId, year, lastNumber: 1 } });
    const quote = await createQuote({ vehicleType: 'Тент' });
    expect(await prisma.dealNumberSequence.findUnique({ where: sequenceWhere() })).toMatchObject({ lastNumber: 1 });
    const winBody = { optionId: quote.quoteOptions[0].id };
    const rejected = await http('POST', `/${quote.id}/win`, manager, winBody);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ message: expect.stringMatching(/Назначьте логиста/) });
    expect(await prisma.dealNumberSequence.findUnique({ where: sequenceWhere() })).toMatchObject({ lastNumber: 1 });

    const assigned = await http('PATCH', `/${quote.id}`, manager, { logistId: logist.id });
    expect(assigned.status).toBe(200);
    expect(await assigned.json()).toMatchObject({ logistId: logist.id });
    const won = await http('POST', `/${quote.id}/win`, manager, winBody);
    expect(won.status).toBe(201);
    expect(await won.json()).toMatchObject({
      number: `AVA-${year}-0002/1`,
      isQuoteDraft: false,
      deal: { number: `AVA-${year}-0002` },
    });
    expect(await prisma.dealNumberSequence.findUnique({ where: sequenceWhere() })).toMatchObject({ lastNumber: 2 });
    expect((await http('POST', `/${quote.id}/win`, manager, winBody)).status).toBe(400);
    expect(await prisma.dealNumberSequence.findUnique({ where: sequenceWhere() })).toMatchObject({ lastNumber: 2 });
  });

  it('takes a free quote and refuses a repeated take', async () => {
    const quote = await createQuote();
    expect((await http('POST', `/${quote.id}/take`, logist)).status).toBe(201);
    expect(await prisma.transportation.findUnique({ where: { id: quote.id } })).toMatchObject({ logistId: logist.id });
    const repeat = await http('POST', `/${quote.id}/take`, logist);
    expect(repeat.status).toBe(400);
    expect(await repeat.json()).toMatchObject({ message: expect.stringMatching(/уже/) });
  });

  it('allocates just one deal number for concurrent win requests', async () => {
    const quote = await createQuote({ vehicleType: 'Тент', logistId: logist.id });
    const before = await prisma.dealNumberSequence.findUniqueOrThrow({ where: sequenceWhere() });
    const responses = await Promise.all([
      http('POST', `/${quote.id}/win`, manager, { optionId: quote.quoteOptions[0].id }),
      http('POST', `/${quote.id}/win`, manager, { optionId: quote.quoteOptions[0].id }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    expect(await prisma.dealNumberSequence.findUnique({ where: sequenceWhere() })).toMatchObject({
      lastNumber: before.lastNumber + 1,
    });
    const persisted = await prisma.transportation.findUniqueOrThrow({
      where: { id: quote.id }, include: { deal: true },
    });
    expect(persisted.number).toBe(`${persisted.deal.number}/1`);
    expect(persisted.deal.number).toBe(`AVA-${year}-${String(before.lastNumber + 1).padStart(4, '0')}`);
  });

  it('allows only one of two competing logists to take a quote', async () => {
    const quote = await createQuote();
    const responses = await Promise.all([
      http('POST', `/${quote.id}/take`, logist),
      http('POST', `/${quote.id}/take`, secondLogist),
    ]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => [400, 403].includes(response.status))).toHaveLength(1);
    const row = await prisma.transportation.findUniqueOrThrow({ where: { id: quote.id } });
    expect([logist.id, secondLogist.id]).toContain(row.logistId);
  });

  it('permits take for heads, admins and directors and denies managers and financiers', async () => {
    for (const actor of [head, admin, director]) {
      const quote = await createQuote();
      const response = await http('POST', `/${quote.id}/take`, actor);
      expect({ role: actor.roles[0], status: response.status, body: await response.json() }).toMatchObject({ status: 201 });
      expect(await prisma.transportation.findUnique({ where: { id: quote.id } })).toMatchObject({ logistId: actor.id });
    }
    for (const actor of [manager, financier]) {
      const quote = await createQuote();
      expect((await http('POST', `/${quote.id}/take`, actor)).status).toBe(403);
      expect(await prisma.transportation.findUnique({ where: { id: quote.id } })).toMatchObject({ logistId: null });
    }
  });

  it('lists own and department-free quotes, hides other departments, and exposes unscoped free quotes', async () => {
    const own = await createQuote();
    const foreign = await createQuote({ departmentId: otherDepartment });
    const unscoped = await createQuote();
    await prisma.deal.update({ where: { id: unscoped.dealId }, data: { departmentId: null } });
    const assignedOwn = await createQuote({ departmentId: otherDepartment, logistId: logist.id });
    const assignedOther = await createQuote({ logistId: secondLogist.id });
    const response = await http('GET', '?limit=100', logist);
    expect(response.status).toBe(200);
    const body = await response.json() as { items: QuoteResponse[] };
    const ids = body.items.map((quote) => quote.id);
    expect(ids).toEqual(expect.arrayContaining([own.id, unscoped.id, assignedOwn.id]));
    expect(ids).not.toContain(foreign.id);
    expect(ids).not.toContain(assignedOther.id);
    expect((await http('GET', `/${foreign.id}`, logist)).status).toBe(403);
    expect((await http('POST', `/${foreign.id}/take`, logist)).status).toBe(403);
    expect((await http('GET', `/${foreign.id}`, otherLogist)).status).toBe(200);
    expect((await http('GET', `/${unscoped.id}`, otherLogist)).status).toBe(200);
    expect((await http('GET', `/${unscoped.id}`, noDepartmentLogist)).status).toBe(200);
    expect((await http('GET', `/${own.id}`, noDepartmentLogist)).status).toBe(403);
  });

  it('PostgreSQL CHECK rejects real transportation without a logist on insert and promotion', async () => {
    const quote = await createQuote();
    await expect(prisma.transportation.create({
      data: {
        dealId: quote.dealId,
        number: 'CHECK-TEST/2',
        sequenceInDeal: 2,
        originPoint: 'Хоргос',
        destinationPoint: 'Алматы',
        transportMode: 'AUTO',
        isQuoteDraft: false,
        logistId: null,
      },
    })).rejects.toThrow(/check constraint/i);
    await expect(prisma.transportation.update({
      where: { id: quote.id }, data: { isQuoteDraft: false },
    })).rejects.toThrow(/check constraint/i);
    expect(await prisma.transportation.findUnique({ where: { id: quote.id } })).toMatchObject({ isQuoteDraft: true, logistId: null });
  });
});
