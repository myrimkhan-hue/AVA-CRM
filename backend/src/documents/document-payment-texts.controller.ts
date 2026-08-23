import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DocumentPaymentTextsService } from './document-payment-texts.service';
import { CreateDocumentPaymentTextDto } from './dto/create-document-payment-text.dto';
import { UpdateDocumentPaymentTextDto } from './dto/update-document-payment-text.dto';

@Controller('document-payment-texts')
export class DocumentPaymentTextsController {
  constructor(
    private readonly documentPaymentTextsService: DocumentPaymentTextsService,
  ) {}

  @Get('active')
  activeOptions() {
    return this.documentPaymentTextsService.activeOptions();
  }

  @Get()
  @Roles('ADMIN')
  list(@CurrentUser() user: AuthUser) {
    return this.documentPaymentTextsService.list(user);
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Body() dto: CreateDocumentPaymentTextDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentPaymentTextsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentPaymentTextDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentPaymentTextsService.update(id, dto, user);
  }
}
