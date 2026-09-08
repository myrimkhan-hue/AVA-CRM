import { NestExpressApplication } from '@nestjs/platform-express';

export function configureHttpSecurity(
  app: NestExpressApplication,
  env: NodeJS.ProcessEnv = process.env,
): void {
  // В prod backend доступен только через один nginx; прямой dev-доступ
  // не доверяет заголовкам клиента. Не включать при публичном порте backend.
  app.set('trust proxy', env.TRUST_PROXY === '1' ? 1 : false);
  const origins = env.CORS_ORIGINS === undefined
    ? (env.NODE_ENV === 'production' ? [] : ['http://localhost:5173'])
    : env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: origins });
}
