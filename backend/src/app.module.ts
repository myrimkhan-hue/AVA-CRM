import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReferencesModule } from './references/references.module';
import { UsersModule } from './users/users.module';
import { ContractorsModule } from './contractors/contractors.module';
import { DealsModule } from './deals/deals.module';
import { TransportationsModule } from './transportations/transportations.module';
import { TableSettingsModule } from './table-settings/table-settings.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ReferencesModule,
    ContractorsModule,
    DealsModule,
    TransportationsModule,
    TableSettingsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
