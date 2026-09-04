import { LegTransportMode, Prisma, TransportMode } from '@prisma/client';
import {
  CreateTransportationLegDto,
  UpdateTransportationLegDto,
} from './dto/transportation-leg.dto';

export function transportationLegCreateData(
  dto: UpdateTransportationLegDto,
  fromPoint: string,
  toPoint: string,
  mode: CreateTransportationLegDto['mode'],
): Prisma.TransportationLegUncheckedCreateWithoutTransportationInput {
  return {
    ...(transportationLegData(
      dto,
    ) as Prisma.TransportationLegUncheckedCreateWithoutTransportationInput),
    orderIndex: 0,
    fromPoint: dto.fromPoint?.trim() ?? fromPoint.trim(),
    toPoint: dto.toPoint?.trim() ?? toPoint.trim(),
    mode: dto.mode ?? mode,
  };
}

export function transportationLegData(
  dto: UpdateTransportationLegDto,
): Prisma.TransportationLegUncheckedUpdateInput {
  return removeUndefined({
    fromPoint: dto.fromPoint?.trim(),
    toPoint: dto.toPoint?.trim(),
    mode: dto.mode,
    subcontractorId: dto.subcontractorId,
    subcontractorRate: dto.subcontractorRate,
    subcontractorRateCurrency: dto.subcontractorRateCurrency?.toUpperCase(),
    plannedStartDate: date(dto.plannedStartDate),
    plannedEndDate: date(dto.plannedEndDate),
    actualStartDate: date(dto.actualStartDate),
    actualEndDate: date(dto.actualEndDate),
    vehicleNumber: text(dto.vehicleNumber),
    trailerNumber: text(dto.trailerNumber),
    status: dto.status,
    driverFullName: text(dto.driverFullName),
    driverPhone: text(dto.driverPhone),
    driverIin: text(dto.driverIin),
    driverLicenseNumber: text(dto.driverLicenseNumber),
    driverLicenseDate: date(dto.driverLicenseDate),
    driverLicenseIssuer: text(dto.driverLicenseIssuer),
  });
}

export function initialLegModeForTransportation(
  mode: TransportMode,
): LegTransportMode {
  return mode === TransportMode.MULTIMODAL ? LegTransportMode.AUTO : mode;
}

function removeUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

function text(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.trim() || null;
}

function date(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}
