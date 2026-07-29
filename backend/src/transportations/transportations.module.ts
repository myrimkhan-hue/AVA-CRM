import { Module } from '@nestjs/common';
import { MarginModule } from '../deals/margin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { TransportationsController } from './transportations.controller';
import { TransportationsService } from './transportations.service';

@Module({
  imports: [MarginModule, NotificationsModule, WhatsappModule],
  controllers: [TransportationsController],
  providers: [TransportationsService],
})
export class TransportationsModule {}
