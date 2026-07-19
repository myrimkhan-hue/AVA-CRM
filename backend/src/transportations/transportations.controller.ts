import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTransportationDto } from './dto/create-transportation.dto';
import { TransportationQueryDto } from './dto/transportation-query.dto';
import { CreateTransportationLegDto, UpdateTransportationLegDto } from './dto/transportation-leg.dto';
import { UpdateTransportationStatusDto } from './dto/update-transportation-status.dto';
import { UpdateTransportationDto } from './dto/update-transportation.dto';
import { TransportationsService } from './transportations.service';

@Controller('transportations')
export class TransportationsController {
  constructor(private readonly transportationsService: TransportationsService) {}

  @Get()
  findAll(@Query() query: TransportationQueryDto, @CurrentUser() user: AuthUser) {
    return this.transportationsService.findAll(query, user);
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportationsService.history(id, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportationsService.findOne(id, user);
  }

  @Post()
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  create(@Body() dto: CreateTransportationDto, @CurrentUser() user: AuthUser) {
    return this.transportationsService.create(dto, user);
  }

  @Post(':id/legs')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  addLeg(
    @Param('id') id: string,
    @Body() dto: CreateTransportationLegDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportationsService.addLeg(id, dto, user);
  }

  @Patch(':id/legs/:legId')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  updateLeg(
    @Param('id') id: string,
    @Param('legId') legId: string,
    @Body() dto: UpdateTransportationLegDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportationsService.updateLeg(id, legId, dto, user);
  }

  @Delete(':id/legs/:legId')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  removeLeg(@Param('id') id: string, @Param('legId') legId: string, @CurrentUser() user: AuthUser) {
    return this.transportationsService.removeLeg(id, legId, user);
  }

  @Post(':id/split')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  split(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportationsService.split(id, user);
  }

  @Post(':id/merge')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  merge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportationsService.merge(id, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTransportationStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportationsService.updateStatus(id, dto, user);
  }

  @Patch(':id/restore')
  @Roles('ADMIN')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportationsService.restore(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTransportationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportationsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportationsService.remove(id, user);
  }
}
