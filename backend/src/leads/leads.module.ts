import { Module } from '@nestjs/common';
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
  ],
  controllers: [LeadsController, WebsiteLeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
