import { Module } from '@nestjs/common';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [LegalEntitiesModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
