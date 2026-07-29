import { Body, Controller, Headers, NotFoundException, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CreateWebsiteLeadDto } from './dto/create-website-lead.dto';
import { verifyWebsiteLeadSignature } from './leads-rules';
import { LeadsService } from './leads.service';

/**
 * Публичный endpoint для формы сайта ava-solution.kz (раздел 4.6.3 ТЗ). Вне JWT-защиты —
 * единственная защита: подпись тела запроса (HMAC-SHA256 общим секретом, заголовок
 * X-Signature) и ограничение частоты запросов (ThrottlerGuard).
 */
@Controller('public/leads')
@UseGuards(ThrottlerGuard)
export class WebsiteLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Post('website')
  async create(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string | undefined,
    @Body() dto: CreateWebsiteLeadDto,
  ) {
    if (!verifyWebsiteLeadSignature(req.rawBody, signature, process.env.WEBSITE_LEADS_WEBHOOK_SECRET)) {
      throw new NotFoundException();
    }

    if (dto.website) {
      // Honeypot сработал — тихо отвечаем успехом, ничего не создаём, чтобы не выдавать боту защиту.
      return { received: true };
    }
    if (!dto.phone?.trim() && !dto.email?.trim()) {
      throw new NotFoundException();
    }

    await this.leadsService.createFromWebsite(dto);
    return { received: true };
  }
}
