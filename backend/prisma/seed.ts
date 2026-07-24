import {
  PrismaClient,
  TaxRateKind,
  TaxRegime,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MOTIVATION_SETTINGS_ID } from '../src/motivation/motivation.constants';

const prisma = new PrismaClient();

const roles = [
  { code: 'ADMIN', name: 'Администратор' },
  { code: 'DIRECTOR', name: 'Руководитель' },
  { code: 'DEPARTMENT_HEAD', name: 'Руководитель отдела' },
  { code: 'MANAGER', name: 'Менеджер' },
  { code: 'LOGIST', name: 'Логист' },
  { code: 'FINANCIER', name: 'Финансист' },
];

const departments = ['Отдел Китая', 'РК/РФ'];

const currencies = [
  { code: 'KZT', name: 'Казахстанский тенге', isBase: true },
  { code: 'USD', name: 'Доллар США', isBase: false },
  { code: 'CNY', name: 'Китайский юань', isBase: false },
  { code: 'RUB', name: 'Российский рубль', isBase: false },
  { code: 'EUR', name: 'Евро', isBase: false },
];

const legalEntities = [
  {
    name: 'ИП Transit Trail',
    numberingPrefix: 'TT',
    taxRegime: TaxRegime.GENERAL,
    bin: '040624501090',
    legalAddress: 'РК, г. Алматы, Жетысуский район, улица Жайсан 52',
    legalForm: 'ИП',
    bankName: 'АО «Kaspi Bank»',
    bankAccount: 'KZ71722S000036131743',
    bankBik: 'CASPKZKA',
    signerPosition: 'Директор',
    signerFullName: 'Юань Эрик Вэнович',
    signerShortName: 'Юань Э. В.',
    signBasis: 'Талона',
    email: 'info@ava-solution.kz',
    taxRates: [
      {
        kind: TaxRateKind.INCOME_TAX,
        ratePercent: '10.00',
        isVatPayer: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        note: 'Начальная ставка ИПН',
      },
      {
        kind: TaxRateKind.VAT,
        ratePercent: '0.00',
        isVatPayer: false,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        note: 'Не является плательщиком НДС',
      },
      {
        kind: TaxRateKind.VAT,
        ratePercent: '16.00',
        isVatPayer: true,
        effectiveFrom: new Date('2026-08-23T00:00:00.000Z'),
        note: 'Планируемая постановка на учёт по НДС',
      },
    ],
  },
  {
    name: 'ТОО AVA Solution',
    numberingPrefix: 'AVA',
    taxRegime: TaxRegime.GENERAL,
    bin: '180840002872',
    legalAddress: 'РК, г. Алматы, Жетысуский район, улица Жайсан 52',
    legalForm: 'ТОО',
    bankName: 'АО «Банк ЦентрКредит», г. Алматы',
    bankAccount: 'KZ168562203126096001',
    bankBik: 'KCJBKZKX',
    signerPosition: 'Генеральный директор',
    signerFullName: 'Юань Вэн-Лун',
    signerShortName: 'Юань В.',
    signBasis: 'Устава',
    phone: '+7 747 523 52 90',
    email: 'info@ava-solution.kz',
    taxRates: [
      {
        kind: TaxRateKind.INCOME_TAX,
        ratePercent: '20.00',
        isVatPayer: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        note: 'Начальная ставка КПН',
      },
      {
        kind: TaxRateKind.VAT,
        ratePercent: '12.00',
        isVatPayer: true,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        note: 'Действующая ставка НДС',
      },
    ],
  },
  {
    name: 'ТОО Alt Corp',
    numberingPrefix: 'ALT',
    taxRegime: TaxRegime.GENERAL,
    bin: '250640033474',
    legalAddress: 'РК, г. Алматы, Бостандыкский район, улица Егизбаева 7/6, кв. 7',
    legalForm: 'ТОО',
    bankName: 'АО «Народный Банк Казахстана»',
    bankAccount: 'KZ30601A861061562641',
    bankBik: 'HSBKKZKX',
    signerPosition: 'Генеральный директор',
    signerFullName: 'Сапаргалиев Алмат Абилдаевич',
    signerShortName: 'Сапаргалиев А. А.',
    signBasis: 'Устава',
    phone: '+7 701 904 7777',
    email: 'altcorp01@gmail.com',
    taxRates: [
      {
        kind: TaxRateKind.INCOME_TAX,
        ratePercent: '20.00',
        isVatPayer: null,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        note: 'Начальная ставка КПН',
      },
      {
        kind: TaxRateKind.VAT,
        ratePercent: '0.00',
        isVatPayer: false,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        note: 'Не является плательщиком НДС',
      },
    ],
  },
];

async function main(): Promise<void> {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  for (const name of departments) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {
        name: currency.name,
        isBase: currency.isBase,
        ...(currency.isBase ? { isActive: true } : {}),
      },
      create: currency,
    });
  }

  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  let seedActorUserId: string | null = null;

  if (!email || !password) {
    console.log(
      'ADMIN_SEED_EMAIL или ADMIN_SEED_PASSWORD не заданы — создание администратора пропущено.',
    );
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
    });
    const admin = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: {
        fullName: 'Администратор',
        email,
        passwordHash,
      },
    });
    seedActorUserId = admin.id;

    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: admin.id, roleId: adminRole.id },
      },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  }

  for (const legalEntityData of legalEntities) {
    const { taxRates, ...legalEntity } = legalEntityData;
    const savedLegalEntity = await prisma.legalEntity.upsert({
      where: { numberingPrefix: legalEntity.numberingPrefix },
      update: {
        name: legalEntity.name,
        taxRegime: legalEntity.taxRegime,
      },
      create: legalEntity,
    });

    for (const taxRate of taxRates) {
      await prisma.legalEntityTaxRate.upsert({
        where: {
          legalEntityId_kind_effectiveFrom: {
            legalEntityId: savedLegalEntity.id,
            kind: taxRate.kind,
            effectiveFrom: taxRate.effectiveFrom,
          },
        },
        update: {},
        create: {
          ...taxRate,
          legalEntityId: savedLegalEntity.id,
          createdByUserId: seedActorUserId,
        },
      });
    }

    // Каждое юрлицо группы должно существовать в системе и как контрагент
    // (раздел 4.4.6 ТЗ), чтобы юрлица могли выставлять счета друг другу.
    if (!savedLegalEntity.contractorId) {
      const contractor = await prisma.contractor.create({
        data: { name: savedLegalEntity.name, types: ['GROUP_ENTITY'] },
      });
      await prisma.legalEntity.update({
        where: { id: savedLegalEntity.id },
        data: { contractorId: contractor.id },
      });
    }
  }

  await prisma.motivationSettings.upsert({
    where: { id: MOTIVATION_SETTINGS_ID },
    update: {},
    create: { id: MOTIVATION_SETTINGS_ID, bonusRatePercent: 10 },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
