import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

const legalEntities = [
  { name: 'ИП Transit Trail', numberingPrefix: 'TT' },
  { name: 'ТОО AVA Solution', numberingPrefix: 'AVA' },
  { name: 'ТОО Alt Corp', numberingPrefix: 'ALT' },
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

  for (const legalEntity of legalEntities) {
    await prisma.legalEntity.upsert({
      where: { numberingPrefix: legalEntity.numberingPrefix },
      update: { name: legalEntity.name },
      create: legalEntity,
    });
  }

  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.log(
      'ADMIN_SEED_EMAIL или ADMIN_SEED_PASSWORD не заданы — создание администратора пропущено.',
    );
    return;
  }

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

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: admin.id, roleId: adminRole.id },
    },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
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
