import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentTemplateType, GeneratedDocumentType } from '@prisma/client';
import { AuthUser } from '../auth/auth-user.type';
import { ru } from '../locales/ru';
import { PrismaService } from '../prisma/prisma.service';
import { transportationVisibilityWhere } from '../transportations/transportation-policy';
import { TransportRequestTemplatePlaceholder } from './document-template.constants';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentsService } from './documents.service';
import { GenerateTransportRequestDto } from './dto/generate-transport-request.dto';
import { amountToWords, formatAmount } from './lib/amount-to-words';
import { safeName } from './lib/fill-docx';
import { buildZayavkaNumberBase, formatDateRu } from './lib/format-date-ru';
import { documentContact } from './lib/document-contact';

const DASH = '—';

@Injectable()
export class RequestGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly documentTemplatesService: DocumentTemplatesService,
  ) {}

  /** Транспортная заявка перевозчику по участку — мы всегда выступаем заказчиком, перевозчик — исполнителем. */
  async generateForLeg(
    transportationId: string,
    legId: string,
    dto: GenerateTransportRequestDto,
    user: AuthUser,
    existingNumber?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const transportation = await this.prisma.transportation.findFirst({
      where: {
        AND: [
          { id: transportationId, isQuoteDraft: false, deletedAt: null, deal: { deletedAt: null } },
          transportationVisibilityWhere(user),
        ],
      },
      select: {
        id: true,
        originPoint: true,
        destinationPoint: true,
        cargoName: true,
        placesCount: true,
        placesUnit: true,
        shipperName: true,
        consigneeName: true,
        loadingAddress: true,
        loadingDateTime: true,
        loadingContactName: true,
        loadingContactPhone: true,
        unloadingAddress: true,
        unloadingContactName: true,
        unloadingContactPhone: true,
        deal: {
          select: { legalEntityId: true },
        },
        logist: {
          select: {
            fullName: true,
            phone: true,
            documentName: true,
            documentPhone: true,
          },
        },
        legs: {
          where: { id: legId },
          select: {
            id: true,
            fromPoint: true,
            toPoint: true,
            subcontractorId: true,
            subcontractorRate: true,
            subcontractorRateCurrency: true,
            vehicleNumber: true,
            trailerNumber: true,
            driverFullName: true,
            driverPhone: true,
            driverIin: true,
            driverLicenseNumber: true,
          },
        },
      },
    });
    if (!transportation) throw new NotFoundException('Перевозка не найдена');
    if (!transportation.logist) throw new BadRequestException(ru.transportations.logistRequired);
    const leg = transportation.legs[0];
    if (!leg) throw new NotFoundException('Участок перевозки не найден');
    if (!leg.subcontractorId) {
      throw new BadRequestException('У участка не выбран перевозчик — заявку создать нельзя');
    }

    if (dto.overrides) {
      await this.documentsService.applyContractorOverrides(leg.subcontractorId, dto.overrides);
    }

    const [legalEntity, carrier] = await Promise.all([
      this.documentsService.getLegalEntityParty(transportation.deal.legalEntityId),
      this.documentsService.getContractorParty(leg.subcontractorId),
    ]);

    const today = new Date();
    const dateStr = formatDateRu(today);
    const baseNumber = buildZayavkaNumberBase(legalEntity.numberingPrefix, today);
    const number = existingNumber
      ?? await this.documentsService.nextDocumentNumber(baseNumber);

    const latestContract = await this.documentsService.findLatestContract(carrier.id, legalEntity.id);
    const title = latestContract
      ? `ЗАЯВКА №1 НА ТРАНСПОРТНЫЕ УСЛУГИ № ${number} от ${dateStr} `
      : `ДОГОВОР-ЗАЯВКА НА ТРАНСПОРТНЫЕ УСЛУГИ № ${number} от ${dateStr}`;
    const appendix = latestContract
      ? `(Приложение № 1 к Договору № ${latestContract.number} от ${formatDateRu(latestContract.generatedAt)})`
      : '';

    const rate = leg.subcontractorRate?.toNumber();
    const currency = leg.subcontractorRateCurrency;
    const costText = rate
      ? `${formatAmount(rate)} ${currency}${currency === 'KZT' ? ` (${amountToWords(rate)} тенге)` : ''}`
      : DASH;

    const vehicle = [leg.vehicleNumber, leg.trailerNumber && `прицеп ${leg.trailerNumber}`]
      .filter(Boolean).join(', ') || DASH;
    const driver = [
      leg.driverFullName,
      leg.driverPhone,
      leg.driverIin && `ИИН ${leg.driverIin}`,
      leg.driverLicenseNumber && `В/У ${leg.driverLicenseNumber}`,
    ].filter(Boolean).join(', ') || DASH;
    const managerContact = documentContact(transportation.logist);

    const templateValues: Record<
      TransportRequestTemplatePlaceholder,
      string | number | null | undefined
    > = {
      ЗАГОЛОВОК_ЗАЯВКИ: title,
      ПРИЛОЖЕНИЕ_К: appendix,
      ЗАКАЗЧИК_НАЗВАНИЕ: legalEntity.name,
      ЗАКАЗЧИК_КРАТКОЕ: legalEntity.name,
      ЗАКАЗЧИК_ДОЛЖНОСТЬ: legalEntity.position,
      ЗАКАЗЧИК_ПОДПИСАНТ: legalEntity.signerFull,
      ЗАК_КР: legalEntity.signerShort,
      ЗАКАЗЧИК_ОСНОВАНИЕ: legalEntity.basis,
      ЗАКАЗЧИК_АДРЕС: legalEntity.address,
      ЗАКАЗЧИК_БИН: legalEntity.bin,
      ЗАКАЗЧИК_БАНК: legalEntity.bank,
      ЗАКАЗЧИК_БИК: legalEntity.bik,
      ЗАКАЗЧИК_СЧЕТ: legalEntity.account,
      ЗАКАЗЧИК_ТЕЛЕФОН: legalEntity.phone,
      ЗАКАЗЧИК_EMAIL: legalEntity.email,
      ЗАКАЗЧИК_МЕНЕДЖЕР: managerContact.name,
      ЗАКАЗЧИК_МЕНЕДЖЕР_ТЕЛ: managerContact.phone,
      ГРУЗООТПРАВИТЕЛЬ: transportation.shipperName ?? DASH,
      ГРУЗОПОЛУЧАТЕЛЬ: transportation.consigneeName ?? DASH,
      МАРШРУТ: `${leg.fromPoint} — ${leg.toPoint}`,
      НАИМЕНОВАНИЕ_ГРУЗА: transportation.cargoName ?? DASH,
      КОЛ_МЕСТ: transportation.placesCount ? `${transportation.placesCount} ${transportation.placesUnit ?? ''}`.trim() : DASH,
      ГАБАРИТЫ: 'Согласно ТТН',
      ДАТА_ПОГРУЗКИ: transportation.loadingDateTime
        ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }).format(transportation.loadingDateTime)
        : DASH,
      АДРЕС_ПОГРУЗКИ: transportation.loadingAddress ?? DASH,
      КОНТАКТ_ПОГРУЗКИ: [transportation.loadingContactName, transportation.loadingContactPhone].filter(Boolean).join(', ') || DASH,
      АДРЕС_РАЗГРУЗКИ: transportation.unloadingAddress ?? DASH,
      КОНТАКТ_РАЗГРУЗКИ: [transportation.unloadingContactName, transportation.unloadingContactPhone].filter(Boolean).join(', ') || DASH,
      ИСПОЛНИТЕЛЬ_НАЗВАНИЕ: carrier.name,
      ИСПОЛНИТЕЛЬ_ТИП: DASH,
      ИСПОЛНИТЕЛЬ_ДОЛЖНОСТЬ: carrier.position,
      ИСПОЛНИТЕЛЬ_ПОДПИСАНТ: carrier.signerFull,
      ИСП_КР: carrier.signerShort,
      ИСПОЛНИТЕЛЬ_ОСНОВАНИЕ: carrier.basis,
      ИСПОЛНИТЕЛЬ_АДРЕС: carrier.address,
      ИСПОЛНИТЕЛЬ_ИИН: carrier.bin,
      ИСПОЛНИТЕЛЬ_БАНК: carrier.bank,
      ИСПОЛНИТЕЛЬ_БИК: carrier.bik,
      ИСПОЛНИТЕЛЬ_СЧЕТ: carrier.account,
      ИСПОЛНИТЕЛЬ_ТАЛОН: carrier.talon,
      ИСПОЛНИТЕЛЬ_КОНТАКТ: carrier.phone,
      ДАННЫЕ_АМ: vehicle,
      ДАННЫЕ_ВОДИТЕЛЯ: driver,
      СТОИМОСТЬ_ЦИФРАМИ: costText,
      СПОСОБ_ОПЛАТЫ: dto.paymentMethod ?? DASH,
      УСЛОВИЯ_ОПЛАТЫ: dto.paymentConditions ?? DASH,
      ДОКУМЕНТЫ: dto.documents ?? 'ТТН',
      ПРИМЕЧАНИЕ: dto.notes ?? DASH,
    };
    const buffer = await this.documentTemplatesService.fillTemplate(
      DocumentTemplateType.TRANSPORT_REQUEST,
      templateValues,
    );

    if (!existingNumber) {
      await this.documentsService.logGeneration({
        type: GeneratedDocumentType.TRANSPORT_REQUEST,
        number,
        transportationId: transportation.id,
        transportationLegId: leg.id,
        contractorId: carrier.id,
        legalEntityId: legalEntity.id,
        generationData: {
          paymentMethod: dto.paymentMethod ?? null,
          paymentConditions: dto.paymentConditions ?? null,
          documents: dto.documents ?? null,
          notes: dto.notes ?? null,
        },
        userId: user.id,
      });
    }

    const filename = `Заявка_${number.replace(/\//g, '-')}_${safeName(carrier.name)}.docx`;
    return { buffer, filename };
  }
}
