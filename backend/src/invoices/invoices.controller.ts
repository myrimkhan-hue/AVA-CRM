import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoiceContextQueryDto } from './dto/invoice-context-query.dto';
import { InvoiceLineDto } from './dto/invoice-line.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { UpdateInvoiceLineDto } from './dto/update-invoice-line.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@Query() query: InvoiceQueryDto, @CurrentUser() user: AuthUser) {
    return this.invoicesService.findAll(query, user);
  }

  @Get('create-context')
  createContext(
    @Query() query: InvoiceContextQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoicesService.createContext(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoicesService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.invoicesService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoicesService.update(id, dto, user);
  }

  @Post(':id/lines')
  addLine(
    @Param('id') id: string,
    @Body() dto: InvoiceLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoicesService.addLine(id, dto, user);
  }

  @Patch(':id/lines/:lineId')
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateInvoiceLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoicesService.updateLine(id, lineId, dto, user);
  }

  @Delete(':id/lines/:lineId')
  removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoicesService.removeLine(id, lineId, user);
  }

  @Post(':id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoicesService.addPayment(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invoicesService.remove(id, user);
  }
}
