import { Module } from '@nestjs/common';
import { MarginModule } from '../deals/margin.module';
import { MotivationController } from './motivation.controller';
import { MotivationService } from './motivation.service';

@Module({
  imports: [MarginModule],
  controllers: [MotivationController],
  providers: [MotivationService],
})
export class MotivationModule {}
