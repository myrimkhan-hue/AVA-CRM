import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface DepartmentResponse {
  id: string;
  name: string;
}

interface RoleResponse {
  code: string;
  name: string;
}

interface LegalEntityResponse {
  id: string;
  name: string;
  numberingPrefix: string;
}

interface UserReferenceResponse {
  id: string;
  fullName: string;
  roles: string[];
  department: { id: string; name: string } | null;
  isActive: boolean;
}

@Controller()
export class ReferencesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('departments')
  departments(): Promise<DepartmentResponse[]> {
    return this.prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('roles')
  roles(): Promise<RoleResponse[]> {
    return this.prisma.role.findMany({
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('legal-entities')
  legalEntities(): Promise<LegalEntityResponse[]> {
    return this.prisma.legalEntity.findMany({
      where: { isActive: true },
      select: { id: true, name: true, numberingPrefix: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('references/users')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST', 'FINANCIER')
  async users(): Promise<UserReferenceResponse[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        roles: { select: { role: { select: { code: true } } } },
        department: { select: { id: true, name: true } },
        isActive: true,
      },
      orderBy: { fullName: 'asc' },
    });
    return users.map(({ roles, ...user }) => ({
      ...user,
      roles: roles.map(({ role }) => role.code),
    }));
  }
}
