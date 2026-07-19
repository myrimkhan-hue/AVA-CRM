import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface DepartmentResponse {
  id: string;
  name: string;
}

interface RoleResponse {
  code: string;
  name: string;
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
}
