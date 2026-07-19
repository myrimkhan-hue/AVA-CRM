import { Module } from '@nestjs/common';
import { ReferencesController } from './references.controller';

@Module({ controllers: [ReferencesController] })
export class ReferencesModule {}
