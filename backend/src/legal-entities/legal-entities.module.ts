import { Module } from '@nestjs/common';
import { LegalEntitiesController } from './legal-entities.controller';
import { LegalEntitiesService } from './legal-entities.service';

@Module({
  controllers: [LegalEntitiesController],
  providers: [LegalEntitiesService],
  exports: [LegalEntitiesService],
})
export class LegalEntitiesModule {}
