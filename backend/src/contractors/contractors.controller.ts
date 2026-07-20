import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContractorsService } from './contractors.service';
import { ContractorQueryDto, DuplicateQueryDto } from './dto/contractor-query.dto';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';

@Controller('contractors')
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Get()
  findAll(@Query() query: ContractorQueryDto, @CurrentUser() user: AuthUser) {
    return this.contractorsService.findAll(query, user.roles);
  }

  @Get('duplicates')
  findDuplicates(@Query() query: DuplicateQueryDto) {
    return this.contractorsService.findDuplicates(query);
  }

  @Get(':id/transportations')
  findTransportations(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contractorsService.findTransportations(id, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contractorsService.findOne(id, user.roles);
  }

  @Post()
  create(@Body() dto: CreateContractorDto, @CurrentUser() user: AuthUser) {
    return this.contractorsService.create(dto, user.id);
  }

  @Patch(':id/restore')
  @Roles('ADMIN')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contractorsService.restore(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContractorDto, @CurrentUser() user: AuthUser) {
    return this.contractorsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.contractorsService.remove(id, user.id);
  }
}
