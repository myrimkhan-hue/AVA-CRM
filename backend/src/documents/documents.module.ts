import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { ContractGeneratorService } from './contract-generator.service';
import { ContractsController } from './contracts.controller';
import { DocumentsService } from './documents.service';
import { RequestGeneratorService } from './request-generator.service';
import { RequestsController } from './requests.controller';

@Module({
  imports: [DealsModule],
  controllers: [ContractsController, RequestsController],
  providers: [DocumentsService, ContractGeneratorService, RequestGeneratorService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
