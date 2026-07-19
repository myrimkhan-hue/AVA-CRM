import { Module } from '@nestjs/common';
import { TransportationsController } from './transportations.controller';
import { TransportationsService } from './transportations.service';

@Module({
  controllers: [TransportationsController],
  providers: [TransportationsService],
})
export class TransportationsModule {}
