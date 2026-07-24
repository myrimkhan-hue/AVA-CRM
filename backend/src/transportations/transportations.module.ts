import { Module } from '@nestjs/common';
import { MarginModule } from '../deals/margin.module';
import { TransportationsController } from './transportations.controller';
import { TransportationsService } from './transportations.service';

@Module({
  imports: [MarginModule],
  controllers: [TransportationsController],
  providers: [TransportationsService],
})
export class TransportationsModule {}
