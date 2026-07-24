import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealQueryDto } from './dto/deal-query.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DealsService } from './deals.service';

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  findAll(@Query() query: DealQueryDto, @CurrentUser() user: AuthUser) {
    return this.dealsService.findAll(query, user);
  }

  @Get(':id/margin')
  margin(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dealsService.getMargin(id, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dealsService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER')
  create(@Body() dto: CreateDealDto, @CurrentUser() user: AuthUser) {
    return this.dealsService.create(dto, user);
  }

  @Patch(':id/stage')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER')
  updateStage(@Param('id') id: string, @Body() dto: UpdateDealStageDto, @CurrentUser() user: AuthUser) {
    return this.dealsService.updateStage(id, dto, user);
  }

  @Patch(':id/restore')
  @Roles('ADMIN')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dealsService.restore(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateDealDto, @CurrentUser() user: AuthUser) {
    return this.dealsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dealsService.remove(id, user);
  }
}
