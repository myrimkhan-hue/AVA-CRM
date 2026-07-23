import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto';
import { LegalEntitiesService } from './legal-entities.service';

@Roles('ADMIN', 'FINANCIER')
@Controller('legal-entities')
export class LegalEntitiesController {
  constructor(private readonly legalEntitiesService: LegalEntitiesService) {}

  @Get('admin')
  findAll() {
    return this.legalEntitiesService.findAll();
  }

  @Post()
  create(
    @Body() dto: CreateLegalEntityDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.legalEntitiesService.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLegalEntityDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.legalEntitiesService.update(id, dto, actor.id);
  }

  @Get(':id/tax-rates')
  findTaxRates(@Param('id') id: string) {
    return this.legalEntitiesService.findTaxRates(id);
  }

  @Post(':id/tax-rates')
  createTaxRate(
    @Param('id') id: string,
    @Body() dto: CreateTaxRateDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.legalEntitiesService.createTaxRate(id, dto, actor.id);
  }
}
