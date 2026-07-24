import { Module } from '@nestjs/common';
import { DealsModule } from '../deals/deals.module';
import { ContractGeneratorService } from './contract-generator.service';
import { ContractsController } from './contracts.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [DealsModule],
  controllers: [ContractsController],
  providers: [DocumentsService, ContractGeneratorService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
