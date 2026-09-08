import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'node:crypto';
import { AppModule } from '../app.module';
import { LeadsService } from '../leads/leads.service';
import { configureHttpSecurity } from '../http-security';
import { ru } from '../locales/ru';
import { PrismaService } from '../prisma/prisma.service';

describe('AppModule HTTP security', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  const previousSecret = process.env.JWT_SECRET;
  const previousWebsiteSecret = process.env.WEBSITE_LEADS_WEBHOOK_SECRET;
  const credentials = { email: 'security@example.test', password: 'test-password' };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-only-auth-security-secret';
    process.env.WEBSITE_LEADS_WEBHOOK_SECRET = 'test-only-website-secret';
    const user = {
      id: 'test-user', email: credentials.email, fullName: 'Тест',
      passwordHash: await bcrypt.hash(credentials.password, 4),
      isActive: true, roles: [], departmentId: null,
    };
    const module = await Test.createTestingModule({
      // Полное дерево модулей и настоящие глобальные guards: здесь важна
      // именно совместная регистрация AuthModule и LeadsModule.
      imports: [AppModule],
    }).overrideProvider(PrismaService).useValue({
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findFirst: jest.fn().mockResolvedValue(user),
      },
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    configureHttpSecurity(app, { TRUST_PROXY: '1' });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    await app?.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousWebsiteSecret === undefined) delete process.env.WEBSITE_LEADS_WEBHOOK_SECRET;
    else process.env.WEBSITE_LEADS_WEBHOOK_SECRET = previousWebsiteSecret;
  });

  function login(ip = '203.0.113.1', password = credentials.password) {
    return fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ ...credentials, password }),
    });
  }

  it('allows five attempts, then returns a localized 429 and Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login(undefined, 'wrong-password')).status).toBe(401);
    }
    const response = await login(undefined, 'wrong-password');
    expect(response.status).toBe(429);
    expect((await response.json()).message).toBe(ru.auth.tooManyLoginAttempts);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('keeps normal login and authenticated refresh working after the login limit', async () => {
    const response = await login();
    expect(response.status).toBe(201);
    const { accessToken, user } = await response.json();
    expect(user.email).toBe(credentials.email);
    for (let i = 0; i < 5; i++) await login();
    expect((await login()).status).toBe(429);
    for (let i = 0; i < 25; i++) {
      const refreshed = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'X-Forwarded-For': '203.0.113.1' },
      });
      expect(refreshed.status).toBe(201);
      expect((await refreshed.json()).accessToken).toEqual(expect.any(String));
    }
    expect((await fetch(`${baseUrl}/api/auth/refresh`, { method: 'POST' })).status).toBe(401);
  });

  it('allows twenty website requests independently of the exhausted login limit', async () => {
    // Подменяем только сохранение заявки; подпись, DTO, маршруты и guards настоящие.
    const saveLead = jest.spyOn(app.get(LeadsService), 'createFromWebsite')
      .mockResolvedValue(undefined);
    for (let i = 0; i < 6; i++) await login(undefined, 'wrong-password');
    const body = JSON.stringify({ name: 'Тестовая заявка', phone: '+77000000000' });
    const signature = createHmac('sha256', process.env.WEBSITE_LEADS_WEBHOOK_SECRET!)
      .update(body).digest('hex');
    const sendLead = () => fetch(`${baseUrl}/api/public/leads/website`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.1',
        'X-Signature': signature,
      },
      body,
    });
    for (let i = 0; i < 20; i++) {
      const response = await sendLead();
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ received: true });
    }
    expect((await sendLead()).status).toBe(429);
    expect(saveLead).toHaveBeenCalledTimes(20);
  });

  it('counts clients behind the same proxy separately and ignores forged earlier hops', async () => {
    for (let i = 0; i < 5; i++) expect((await login()).status).toBe(201);
    expect((await login('198.51.100.9, 203.0.113.1')).status).toBe(429);
    expect((await login('203.0.113.2')).status).toBe(201);
  });

  it('ignores forwarded headers when accessed directly without trusted proxy mode', async () => {
    app.set('trust proxy', false);
    for (let i = 0; i < 5; i++) expect((await login(`203.0.113.${i + 1}`)).status).toBe(201);
    expect((await login('203.0.113.99')).status).toBe(429);
  });

  it('allows local development CORS but does not authorize other sites', async () => {
    for (const origin of ['http://localhost:5173', 'https://untrusted.example']) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      });
      expect(response.headers.get('access-control-allow-origin')).toBe(
        origin === 'http://localhost:5173' ? origin : null,
      );
    }
  });
});
