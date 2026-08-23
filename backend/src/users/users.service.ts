import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateDocumentContactDto } from './dto/update-document-contact.dto';

const userInclude = {
  department: true,
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  documentName: string | null;
  documentPhone: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  roles: string[];
  isActive: boolean;
  motivationRatePercent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type Changes = Record<string, { old: unknown; new: unknown }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      include: userInclude,
      orderBy: { fullName: 'asc' },
    });
    return users.map((user) => this.toResponse(user));
  }

  async create(dto: CreateUserDto, actorUserId: string): Promise<UserResponse> {
    const email = dto.email.trim().toLowerCase();
    const roleCodes = this.unique(dto.roles);
    const roles = await this.resolveRoles(roleCodes);
    await this.ensureDepartment(dto.departmentId);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            fullName: dto.fullName.trim(),
            email,
            phone: dto.phone?.trim() || null,
            documentName: dto.documentName?.trim() || null,
            documentPhone: dto.documentPhone?.trim() || null,
            departmentId: dto.departmentId || null,
            passwordHash,
            roles: { create: roles.map((role) => ({ roleId: role.id })) },
          },
          include: userInclude,
        });
        await this.writeAudit(tx, actorUserId, created.id, AuditAction.CREATE, {
          fullName: { old: null, new: created.fullName },
          email: { old: null, new: created.email },
          phone: { old: null, new: created.phone },
          documentName: { old: null, new: created.documentName },
          documentPhone: { old: null, new: created.documentPhone },
          departmentId: { old: null, new: created.departmentId },
          roles: { old: [], new: roleCodes },
          password: { old: null, new: '***' },
          isActive: { old: null, new: created.isActive },
        });
        return created;
      });
      return this.toResponse(user);
    } catch (error: unknown) {
      this.handlePrismaError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorUserId: string,
  ): Promise<UserResponse> {
    const current = await this.getUser(id);
    const roleCodes = dto.roles ? this.unique(dto.roles) : undefined;
    const roles = roleCodes ? await this.resolveRoles(roleCodes) : undefined;
    if (dto.departmentId !== undefined) await this.ensureDepartment(dto.departmentId);

    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.documentName !== undefined) {
      data.documentName = dto.documentName?.trim() || null;
    }
    if (dto.documentPhone !== undefined) {
      data.documentPhone = dto.documentPhone?.trim() || null;
    }
    if (dto.motivationRatePercent !== undefined) {
      data.motivationRatePercent =
        dto.motivationRatePercent === null
          ? null
          : new Prisma.Decimal(dto.motivationRatePercent);
    }
    if (dto.departmentId !== undefined) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }
    const changes = this.buildChanges(current, dto, roleCodes);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        if (roles) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.createMany({
            data: roles.map((role) => ({ userId: id, roleId: role.id })),
          });
        }
        const updated = await tx.user.update({
          where: { id },
          data,
          include: userInclude,
        });
        await this.writeAudit(tx, actorUserId, id, AuditAction.UPDATE, changes);
        return updated;
      });
      return this.toResponse(user);
    } catch (error: unknown) {
      this.handlePrismaError(error);
    }
  }

  async resetPassword(
    id: string,
    password: string,
    actorUserId: string,
  ): Promise<UserResponse> {
    await this.getUser(id);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { passwordHash },
        include: userInclude,
      });
      await this.writeAudit(tx, actorUserId, id, AuditAction.UPDATE, {
        password: { old: '***', new: '***' },
      });
      return updated;
    });
    return this.toResponse(user);
  }

  async setActive(
    id: string,
    isActive: boolean,
    actorUserId: string,
  ): Promise<UserResponse> {
    const current = await this.getUser(id);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive },
        include: userInclude,
      });
      await this.writeAudit(
        tx,
        actorUserId,
        id,
        isActive ? AuditAction.RESTORE : AuditAction.UPDATE,
        { isActive: { old: current.isActive, new: isActive } },
      );
      return updated;
    });
    return this.toResponse(user);
  }

  async getOwnDocumentContact(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        documentName: true,
        documentPhone: true,
      },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async updateOwnDocumentContact(
    id: string,
    dto: UpdateDocumentContactDto,
  ) {
    const current = await this.getOwnDocumentContact(id);
    const documentName = dto.documentName === undefined
      ? current.documentName
      : dto.documentName?.trim() || null;
    const documentPhone = dto.documentPhone === undefined
      ? current.documentPhone
      : dto.documentPhone?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { documentName, documentPhone },
        select: {
          id: true,
          fullName: true,
          phone: true,
          documentName: true,
          documentPhone: true,
        },
      });
      await this.writeAudit(tx, id, id, AuditAction.UPDATE, {
        documentName: { old: current.documentName, new: documentName },
        documentPhone: { old: current.documentPhone, new: documentPhone },
      });
      return updated;
    });
  }

  private async getUser(id: string): Promise<UserWithRelations> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  private async resolveRoles(codes: string[]): Promise<{ id: string; code: string }[]> {
    const roles = await this.prisma.role.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    const foundCodes = new Set(roles.map((role) => role.code));
    const unknown = codes.filter((code) => !foundCodes.has(code));
    if (unknown.length) {
      throw new BadRequestException(`Неизвестные роли: ${unknown.join(', ')}`);
    }
    return roles;
  }

  private async ensureDepartment(departmentId: string | null | undefined): Promise<void> {
    if (!departmentId) return;
    const exists = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException('Отдел не найден');
  }

  private buildChanges(
    current: UserWithRelations,
    dto: UpdateUserDto,
    roleCodes?: string[],
  ): Changes {
    const changes: Changes = {};
    if (dto.fullName !== undefined)
      changes.fullName = { old: current.fullName, new: dto.fullName.trim() };
    if (dto.email !== undefined)
      changes.email = { old: current.email, new: dto.email.trim().toLowerCase() };
    if (dto.phone !== undefined)
      changes.phone = { old: current.phone, new: dto.phone?.trim() || null };
    if (dto.documentName !== undefined)
      changes.documentName = {
        old: current.documentName,
        new: dto.documentName?.trim() || null,
      };
    if (dto.documentPhone !== undefined)
      changes.documentPhone = {
        old: current.documentPhone,
        new: dto.documentPhone?.trim() || null,
      };
    if (dto.departmentId !== undefined)
      changes.departmentId = { old: current.departmentId, new: dto.departmentId || null };
    if (dto.motivationRatePercent !== undefined)
      changes.motivationRatePercent = {
        old: current.motivationRatePercent?.toString() ?? null,
        new: dto.motivationRatePercent === null ? null : String(dto.motivationRatePercent),
      };
    if (roleCodes)
      changes.roles = {
        old: current.roles.map(({ role }) => role.code),
        new: roleCodes,
      };
    return changes;
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    entityId: string,
    action: AuditAction,
    changes: Changes,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId,
        entityType: 'User',
        entityId,
        action,
        changes: changes as Prisma.InputJsonValue,
      },
    });
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim().toUpperCase()))];
  }

  private toResponse(user: UserWithRelations): UserResponse {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      documentName: user.documentName,
      documentPhone: user.documentPhone,
      departmentId: user.departmentId,
      department: user.department,
      roles: user.roles.map(({ role }) => role.code),
      isActive: user.isActive,
      motivationRatePercent: user.motivationRatePercent?.toString() ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Пользователь с таким email уже существует');
    }
    throw error;
  }
}
