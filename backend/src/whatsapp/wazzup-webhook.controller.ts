import { Body, Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { WazzupWebhookPayload, WhatsappService } from './whatsapp.service';

/**
 * Отдельный публичный контроллер (вне JWT-защиты) — сюда Wazzup шлёт вебхуки о новых
 * сообщениях/статусах. Секрет в пути — единственная защита от посторонних запросов,
 * т.к. Wazzup поддерживает Authorization-заголовок только через более сложный WAuth-флоу.
 */
@Controller('webhooks/wazzup')
export class WazzupWebhookController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Public()
  @Post(':secret')
  handle(@Param('secret') secret: string, @Body() payload: WazzupWebhookPayload) {
    const expected = process.env.WAZZUP_WEBHOOK_SECRET;
    if (!expected || secret !== expected) {
      throw new NotFoundException();
    }
    return this.whatsappService.handleWebhook(payload);
  }
}
