import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestsService } from './payment-requests.service';

@Module({
  imports: [InvoicesModule, NotificationsModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService],
  exports: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
