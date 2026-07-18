import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type HealthResponse = { status: 'ok'; db: 'ok' | 'error' };

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok' };
    } catch {
      return { status: 'ok', db: 'error' };
    }
  }
}
