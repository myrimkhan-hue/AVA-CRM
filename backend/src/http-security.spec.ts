import { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttpSecurity } from './http-security';

describe('HTTP security configuration', () => {
  it.each([
    [{}, ['http://localhost:5173']],
    [{ NODE_ENV: 'production' }, []],
    [{ CORS_ORIGINS: ' https://crm.example.kz, https://test.example.kz, ' },
      ['https://crm.example.kz', 'https://test.example.kz']],
    [{ CORS_ORIGINS: '' }, []],
  ])('uses an explicit CORS allowlist for %j', (env, origins) => {
    const app = { set: jest.fn(), enableCors: jest.fn() };
    configureHttpSecurity(app as unknown as NestExpressApplication, env);
    expect(app.enableCors).toHaveBeenCalledWith({ origin: origins });
    expect(app.set).toHaveBeenCalledWith('trust proxy', false);
  });
});
