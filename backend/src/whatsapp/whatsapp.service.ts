import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WhatsAppDirection, WhatsAppMessageStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuthUser } from '../auth/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { LinkUnmatchedDto } from './dto/link-unmatched.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { normalizePhone, toWhatsAppChatId } from './whatsapp-rules';
import { WazzupClientService } from './wazzup-client.service';

const messageInclude = {
  author: { select: { id: true, fullName: true } },
  template: { select: { id: true, title: true } },
  contractor: { select: { id: true, name: true } },
} satisfies Prisma.WhatsAppMessageInclude;

interface WazzupWebhookContact {
  name?: string;
}

interface WazzupWebhookMessage {
  messageId: string;
  dateTime?: string;
  channelId?: string;
  chatType?: string;
  chatId: string;
  type?: string;
  isEcho?: boolean;
  contact?: WazzupWebhookContact;
  text?: string;
  status?: string;
}

interface WazzupWebhookStatus {
  messageId: string;
  status: string;
}

export interface WazzupWebhookPayload {
  test?: boolean;
  messages?: WazzupWebhookMessage[];
  statuses?: WazzupWebhookStatus[];
}

const STATUS_MAP: Record<string, WhatsAppMessageStatus> = {
  sent: WhatsAppMessageStatus.SENT,
  delivered: WhatsAppMessageStatus.DELIVERED,
  read: WhatsAppMessageStatus.READ,
  failed: WhatsAppMessageStatus.FAILED,
  error: WhatsAppMessageStatus.FAILED,
};

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wazzupClient: WazzupClientService,
  ) {}

  isConfigured(): boolean {
    return this.wazzupClient.isConfigured();
  }

  async findForContractor(contractorId: string) {
    return this.prisma.whatsAppMessage.findMany({
      where: { contractorId },
      include: messageInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findForDeal(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId }, select: { clientId: true } });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    return this.findForContractor(deal.clientId);
  }

  async send(dto: SendMessageDto, user: AuthUser) {
    return this.sendToContractor(dto.contractorId, dto.text, user.id, dto.templateId);
  }

  async sendToContractor(contractorId: string, text: string, authorUserId: string, templateId?: string) {
    const contractor = await this.prisma.contractor.findUnique({
      where: { id: contractorId },
      select: {
        id: true,
        phone: true,
        contacts: { select: { phone: true, whatsapp: true } },
      },
    });
    if (!contractor) throw new NotFoundException('Контрагент не найден');

    const rawPhone =
      contractor.phone ??
      contractor.contacts.find((c) => c.whatsapp)?.whatsapp ??
      contractor.contacts.find((c) => c.phone)?.phone ??
      null;
    const chatId = toWhatsAppChatId(rawPhone);
    if (!chatId) {
      throw new BadRequestException('У контрагента не указан телефон/WhatsApp — отправка невозможна');
    }

    const crmMessageId = randomUUID();
    const result = await this.wazzupClient.sendMessage(chatId, text, crmMessageId);

    return this.prisma.whatsAppMessage.create({
      data: {
        direction: WhatsAppDirection.OUT,
        channelId: process.env.WAZZUP_CHANNEL_ID ?? null,
        chatId,
        contractorId: contractor.id,
        text,
        status: WhatsAppMessageStatus.SENT,
        wazzupMessageId: result.messageId,
        templateId: templateId ?? null,
        authorUserId,
      },
      include: messageInclude,
    });
  }

  async handleWebhook(payload: WazzupWebhookPayload): Promise<{ ok: true }> {
    if (payload.test) return { ok: true };

    if (payload.messages?.length) {
      const contractorByChat = await this.buildContractorPhoneIndex();
      for (const message of payload.messages) {
        const direction = message.status === 'inbound' ? WhatsAppDirection.IN : WhatsAppDirection.OUT;
        const contractorId = contractorByChat.get(normalizePhone(message.chatId) ?? '') ?? null;
        await this.prisma.whatsAppMessage.upsert({
          where: { wazzupMessageId: message.messageId },
          update: {},
          create: {
            wazzupMessageId: message.messageId,
            direction,
            channelId: message.channelId ?? null,
            chatId: message.chatId,
            contactName: message.contact?.name ?? null,
            contractorId,
            text: message.text ?? '',
            status: direction === WhatsAppDirection.IN ? WhatsAppMessageStatus.RECEIVED : WhatsAppMessageStatus.SENT,
          },
        });
      }
    }

    if (payload.statuses?.length) {
      for (const status of payload.statuses) {
        const mapped = STATUS_MAP[status.status];
        if (!mapped) continue;
        await this.prisma.whatsAppMessage.updateMany({
          where: { wazzupMessageId: status.messageId },
          data: { status: mapped },
        });
      }
    }

    return { ok: true };
  }

  async findUnmatched() {
    const messages = await this.prisma.whatsAppMessage.findMany({
      where: { contractorId: null },
      orderBy: { createdAt: 'desc' },
    });
    const byChat = new Map<string, { chatId: string; contactName: string | null; lastText: string; lastAt: Date; count: number }>();
    for (const message of messages) {
      const existing = byChat.get(message.chatId);
      if (existing) {
        existing.count += 1;
      } else {
        byChat.set(message.chatId, {
          chatId: message.chatId,
          contactName: message.contactName,
          lastText: message.text,
          lastAt: message.createdAt,
          count: 1,
        });
      }
    }
    return [...byChat.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  }

  async linkUnmatched(chatId: string, dto: LinkUnmatchedDto) {
    const contractor = await this.prisma.contractor.findUnique({ where: { id: dto.contractorId }, select: { id: true } });
    if (!contractor) throw new NotFoundException('Контрагент не найден');
    const result = await this.prisma.whatsAppMessage.updateMany({
      where: { chatId, contractorId: null },
      data: { contractorId: dto.contractorId },
    });
    return { updated: result.count };
  }

  async findTemplates(activeOnly: boolean) {
    return this.prisma.whatsAppTemplate.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { title: 'asc' },
    });
  }

  async createTemplate(dto: CreateTemplateDto) {
    return this.prisma.whatsAppTemplate.create({ data: dto });
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    await this.getTemplate(id);
    return this.prisma.whatsAppTemplate.update({ where: { id }, data: dto });
  }

  async removeTemplate(id: string) {
    await this.getTemplate(id);
    await this.prisma.whatsAppTemplate.delete({ where: { id } });
  }

  private async getTemplate(id: string) {
    const template = await this.prisma.whatsAppTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Шаблон не найден');
    return template;
  }

  private async buildContractorPhoneIndex(): Promise<Map<string, string>> {
    const contractors = await this.prisma.contractor.findMany({
      where: {
        deletedAt: null,
        OR: [{ phone: { not: null } }, { contacts: { some: { OR: [{ phone: { not: null } }, { whatsapp: { not: null } }] } } }],
      },
      select: { id: true, phone: true, contacts: { select: { phone: true, whatsapp: true } } },
    });
    const index = new Map<string, string>();
    for (const contractor of contractors) {
      const phones = [contractor.phone, ...contractor.contacts.flatMap((c) => [c.phone, c.whatsapp])];
      for (const phone of phones) {
        const normalized = normalizePhone(phone);
        if (normalized && !index.has(normalized)) index.set(normalized, contractor.id);
      }
    }
    return index;
  }
}
