import { ForbiddenException } from '@nestjs/common';
import { DocumentTemplateType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentTemplatesService } from './document-templates.service';

function user(roles: string[]): AuthUser {
  return {
    id: 'user-1',
    fullName: 'Тестовый пользователь',
    email: 'test@ava.local',
    roles,
    departmentId: null,
  };
}

describe('Права управления шаблонами документов', () => {
  const documentTemplate = {
    findUnique: jest.fn(),
  };
  const transaction = jest.fn();
  const prisma = {
    documentTemplate,
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new DocumentTemplatesService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it.each(['MANAGER', 'LOGIST', 'FINANCIER'])(
    'не разрешает роли %s загрузить шаблон',
    async (role) => {
      await expect(service.upload(
        {
          type: DocumentTemplateType.CONTRACT,
          displayName: 'Договор',
        },
        undefined,
        user([role]),
      )).rejects.toThrow(ForbiddenException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['MANAGER', 'LOGIST', 'FINANCIER'])(
    'не разрешает роли %s активировать шаблон',
    async (role) => {
      await expect(service.activate('template-1', user([role])))
        .rejects.toThrow(ForbiddenException);
      expect(documentTemplate.findUnique).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
