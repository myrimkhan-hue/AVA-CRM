import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ContractorsModule } from '../contractors/contractors.module';
import { DealsModule } from '../deals/deals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { WebsiteLeadsController } from './website-leads.controller';

@Module({
  imports: [
    ContractorsModule,
    DealsModule,
    NotificationsModule,
    // Публичный приём заявок с сайта (раздел 4.6.3 ТЗ): не более 20 запросов в минуту с одного IP.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
  ],
  controllers: [LeadsController, WebsiteLeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
