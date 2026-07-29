import { Module } from '@nestjs/common';
import { WazzupClientService } from './wazzup-client.service';
import { WazzupWebhookController } from './wazzup-webhook.controller';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [WhatsappController, WazzupWebhookController],
  providers: [WhatsappService, WazzupClientService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
