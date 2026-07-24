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
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PayPaymentRequestDto } from './dto/pay-payment-request.dto';
import { PaymentRequestContextQueryDto } from './dto/payment-request-context-query.dto';
import { PaymentRequestQueryDto } from './dto/payment-request-query.dto';
import { ReissuePaymentRequestDto } from './dto/reissue-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';
import { PaymentRequestsService } from './payment-requests.service';

@Controller('payment-requests')
export class PaymentRequestsController {
  constructor(
    private readonly paymentRequestsService: PaymentRequestsService,
  ) {}

  @Get()
  findAll(
    @Query() query: PaymentRequestQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentRequestsService.findAll(query, user);
  }

  @Get('create-context')
  createContext(
    @Query() query: PaymentRequestContextQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentRequestsService.createContext(query, user);
  }

  @Post()
  create(
    @Body() dto: CreatePaymentRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentRequestsService.create(dto, user);
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentRequestsService.approve(id, user);
  }

  @Patch(':id/pay')
  @Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
  pay(
    @Param('id') id: string,
    @Body() dto: PayPaymentRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentRequestsService.pay(id, dto, user);
  }

  @Patch(':id/reissue')
  @Roles('ADMIN', 'DIRECTOR', 'FINANCIER')
  reissue(
    @Param('id') id: string,
    @Body() dto: ReissuePaymentRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentRequestsService.reissue(id, dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentRequestsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentRequestsService.remove(id, user);
  }
}
