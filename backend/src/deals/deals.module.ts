import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { MarginModule } from './margin.module';

@Module({
  imports: [MarginModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
