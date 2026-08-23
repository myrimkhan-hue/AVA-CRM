import { ForbiddenException } from '@nestjs/common';
import { DocumentPaymentTextType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentPaymentTextsService } from './document-payment-texts.service';

function user(roles: string[]): AuthUser {
  return {
    id: 'user-1',
    fullName: 'Тестовый пользователь',
    email: 'test@ava.local',
    roles,
    departmentId: null,
  };
}

describe('Справочник формулировок оплаты', () => {
  const documentPaymentText = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  const transaction = jest.fn();
  const prisma = {
    documentPaymentText,
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new DocumentPaymentTextsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it.each(['DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST', 'FINANCIER'])(
    'не разрешает роли %s создавать формулировки',
    async (role) => {
      await expect(service.create({
        type: DocumentPaymentTextType.PAYMENT_METHOD,
        shortName: 'Безналичный расчёт',
        text: 'Оплата переводом',
      }, user([role]))).rejects.toThrow(ForbiddenException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST', 'FINANCIER'])(
    'не разрешает роли %s изменять формулировки',
    async (role) => {
      await expect(service.update(
        'text-1',
        { text: 'Новый текст' },
        user([role]),
      )).rejects.toThrow(ForbiddenException);
      expect(documentPaymentText.findUnique).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('возвращает активные значения по умолчанию для обоих видов', async () => {
    const now = new Date('2026-08-22T00:00:00.000Z');
    const method = {
      id: 'method-1',
      type: DocumentPaymentTextType.PAYMENT_METHOD,
      shortName: 'Безналичный расчёт',
      text: 'Оплата переводом',
      sortOrder: 1,
      isDefault: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const conditions = {
      ...method,
      id: 'conditions-1',
      type: DocumentPaymentTextType.PAYMENT_CONDITIONS,
      shortName: 'После выгрузки',
      text: 'Оплата после выгрузки',
    };
    documentPaymentText.findMany.mockResolvedValue([method, conditions]);

    await expect(service.activeOptions()).resolves.toEqual({
      items: [method, conditions],
      defaults: {
        PAYMENT_METHOD: method,
        PAYMENT_CONDITIONS: conditions,
      },
    });
    expect(documentPaymentText.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});
