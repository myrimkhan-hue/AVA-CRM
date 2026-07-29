import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssignLeadsDto } from './dto/assign-leads.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { DistributeLeadsDto } from './dto/distribute-leads.dto';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { TouchLeadDto } from './dto/touch-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Query() query: LeadQueryDto, @CurrentUser() user: AuthUser) {
    return this.leadsService.findAll(query, user);
  }

  @Get('my-calls')
  findMyCalls(@CurrentUser() user: AuthUser) {
    return this.leadsService.findMyCalls(user);
  }

  @Post('import')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD')
  import(@Body() dto: ImportLeadsDto, @CurrentUser() user: AuthUser) {
    return this.leadsService.import(dto, user);
  }

  @Get('import-batches')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD')
  findImportBatches(@CurrentUser() user: AuthUser) {
    return this.leadsService.findImportBatches(user);
  }

  @Get('reports/reaction-time')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD')
  getReactionTimeReport(@CurrentUser() user: AuthUser) {
    return this.leadsService.getReactionTimeReport(user);
  }

  @Patch('assign')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD')
  assign(@Body() dto: AssignLeadsDto, @CurrentUser() user: AuthUser) {
    return this.leadsService.assign(dto, user);
  }

  @Patch('distribute')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD')
  distribute(@Body() dto: DistributeLeadsDto, @CurrentUser() user: AuthUser) {
    return this.leadsService.distribute(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.leadsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.update(id, dto, user);
  }

  @Patch(':id/touch')
  touch(
    @Param('id') id: string,
    @Body() dto: TouchLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.touch(id, dto, user);
  }

  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leadsService.convert(id, dto, user);
  }
}
