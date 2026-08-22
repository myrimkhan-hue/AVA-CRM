import { GeneratedDocumentType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { generatedDocumentVisibilityWhere } from './document-policy';

const DEPARTMENT_ID = 'department-1';

function user(
  roles: string[],
  departmentId: string | null = null,
  id = 'user-1',
): AuthUser {
  return {
    id,
    fullName: 'Тестовый пользователь',
    email: 'test@ava.local',
    roles,
    departmentId,
  };
}

describe('Права доступа: журнал сгенерированных документов', () => {
  it('администратор и руководитель видят весь журнал, включая записи без источника', () => {
    for (const role of ['ADMIN', 'DIRECTOR']) {
      expect(generatedDocumentVisibilityWhere(user([role]))).toEqual({});
    }
  });

  it('финансист видит документы только через доступную карточку-источник', () => {
    expect(generatedDocumentVisibilityWhere(user(['FINANCIER']))).toEqual({
      OR: [
        {
          type: GeneratedDocumentType.CONTRACT,
          OR: [
            { deal: { is: { AND: [{ deletedAt: null }, {}] } } },
            {
              dealId: null,
              contractor: { is: { deletedAt: null } },
            },
          ],
        },
        {
          type: GeneratedDocumentType.TRANSPORT_REQUEST,
          transportation: {
            is: { AND: [{ deletedAt: null, deal: { deletedAt: null } }, {}] },
          },
        },
        {
          type: GeneratedDocumentType.INVOICE,
          invoice: { is: { AND: [{ deletedAt: null }, {}] } },
        },
      ],
    });
  });

  it('менеджер наследует видимость своих сделок, перевозок и счетов', () => {
    expect(generatedDocumentVisibilityWhere(user(['MANAGER'], DEPARTMENT_ID, 'manager')))
      .toEqual({
        OR: [
          {
            type: GeneratedDocumentType.CONTRACT,
            OR: [
              {
                deal: {
                  is: {
                    AND: [{ deletedAt: null }, { OR: [{ responsibleId: 'manager' }] }],
                  },
                },
              },
              {
                dealId: null,
                contractor: { is: { deletedAt: null } },
              },
            ],
          },
          {
            type: GeneratedDocumentType.TRANSPORT_REQUEST,
            transportation: {
              is: {
                AND: [
                  { deletedAt: null, deal: { deletedAt: null } },
                  { OR: [{ deal: { responsibleId: 'manager' } }] },
                ],
              },
            },
          },
          {
            type: GeneratedDocumentType.INVOICE,
            invoice: {
              is: {
                AND: [
                  { deletedAt: null },
                  {
                    transportation: {
                      is: { OR: [{ deal: { responsibleId: 'manager' } }] },
                    },
                  },
                ],
              },
            },
          },
        ],
      });
  });

  it('руководитель отдела наследует правила каждого типа карточки', () => {
    const where = generatedDocumentVisibilityWhere(
      user(['DEPARTMENT_HEAD'], DEPARTMENT_ID, 'head'),
    );
    expect(where).toEqual({
      OR: [
        {
          type: GeneratedDocumentType.CONTRACT,
          OR: [
            {
              deal: {
                is: {
                  AND: [
                    { deletedAt: null },
                    {
                      OR: [
                        { departmentId: DEPARTMENT_ID },
                        { responsibleId: 'head' },
                      ],
                    },
                  ],
                },
              },
            },
            {
              dealId: null,
              contractor: { is: { deletedAt: null } },
            },
          ],
        },
        {
          type: GeneratedDocumentType.TRANSPORT_REQUEST,
          transportation: {
            is: {
              AND: [
                { deletedAt: null, deal: { deletedAt: null } },
                {
                  OR: [
                    { deal: { departmentId: DEPARTMENT_ID } },
                    { deal: { responsibleId: 'head' } },
                    { logistId: 'head' },
                  ],
                },
              ],
            },
          },
        },
        {
          type: GeneratedDocumentType.INVOICE,
          invoice: {
            is: {
              AND: [
                { deletedAt: null },
                {
                  transportation: {
                    is: { OR: [{ deal: { departmentId: DEPARTMENT_ID } }] },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  });

  it('логист видит договоры контрагентов и заявки по своим перевозкам, но не счета', () => {
    expect(generatedDocumentVisibilityWhere(user(['LOGIST'], null, 'logist'))).toEqual({
      OR: [
        {
          type: GeneratedDocumentType.CONTRACT,
          OR: [
            {
              deal: {
                is: { AND: [{ deletedAt: null }, { id: { in: [] } }] },
              },
            },
            {
              dealId: null,
              contractor: { is: { deletedAt: null } },
            },
          ],
        },
        {
          type: GeneratedDocumentType.TRANSPORT_REQUEST,
          transportation: {
            is: {
              AND: [
                { deletedAt: null, deal: { deletedAt: null } },
                { OR: [{ logistId: 'logist' }] },
              ],
            },
          },
        },
        {
          type: GeneratedDocumentType.INVOICE,
          invoice: {
            is: { AND: [{ deletedAt: null }, { id: { in: [] } }] },
          },
        },
      ],
    });
  });

  it.each(['MANAGER', 'LOGIST'])(
    'договор контрагента без сделки виден роли %s',
    (role) => {
      const where = generatedDocumentVisibilityWhere(user([role])) as {
        OR: Array<{ type?: GeneratedDocumentType; OR?: unknown[] }>;
      };
      expect(where.OR[0]?.OR).toContainEqual({
        dealId: null,
        contractor: { is: { deletedAt: null } },
      });
    },
  );

  it('двойная роль менеджера и логиста суммирует доступ к перевозкам', () => {
    const where = generatedDocumentVisibilityWhere(
      user(['MANAGER', 'LOGIST'], null, 'combined'),
    ) as { OR: Array<Record<string, unknown>> };
    expect(where.OR[1]).toEqual({
      type: GeneratedDocumentType.TRANSPORT_REQUEST,
      transportation: {
        is: {
          AND: [
            { deletedAt: null, deal: { deletedAt: null } },
            {
              OR: [
                { deal: { responsibleId: 'combined' } },
                { logistId: 'combined' },
              ],
            },
          ],
        },
      },
    });
  });

  it('неизвестная роль не получает открытого условия', () => {
    const where = generatedDocumentVisibilityWhere(user(['UNKNOWN']));
    expect(where).not.toEqual({});
    expect(JSON.stringify(where)).toContain('"in":[]');
  });
});
