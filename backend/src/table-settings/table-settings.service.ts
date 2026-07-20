import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTableSettingsDto } from './dto/update-table-settings.dto';

@Injectable()
export class TableSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string, tableKey: string) {
    this.assertTableKey(tableKey);
    const settings = await this.prisma.userTableSettings.findUnique({
      where: { userId_tableKey: { userId, tableKey } },
      select: { columns: true },
    });
    return settings ?? null;
  }

  async upsert(userId: string, tableKey: string, dto: UpdateTableSettingsDto) {
    this.assertTableKey(tableKey);
    if (new Set(dto.columns.map((column) => column.key)).size !== dto.columns.length) {
      throw new BadRequestException('Настройки не должны содержать повторяющиеся колонки');
    }
    const columns: Prisma.InputJsonArray = dto.columns.map((column) => ({
      key: column.key,
      visible: column.visible,
    }));
    return this.prisma.userTableSettings.upsert({
      where: { userId_tableKey: { userId, tableKey } },
      create: {
        userId,
        tableKey,
        columns,
      },
      update: { columns },
      select: { columns: true },
    });
  }

  private assertTableKey(tableKey: string): void {
    if (!['transportations', 'contractors', 'deals'].includes(tableKey)) {
      throw new BadRequestException('Указана неизвестная таблица');
    }
  }
}
