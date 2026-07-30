import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractsService } from './contracts.service';

// Договоры видит вся коммерческая часть команды (справочник контрагентов тоже
// открыт всем); менять — руководство, юрлица ведёт финансист.
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@Query() query: ContractQueryDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER')
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthUser) {
    return this.contractsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DIRECTOR')
  remove(@Param('id') id: string) {
    return this.contractsService.remove(id);
  }
}
