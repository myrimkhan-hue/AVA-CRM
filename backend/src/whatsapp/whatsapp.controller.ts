import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { LinkUnmatchedDto } from './dto/link-unmatched.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  status() {
    return { configured: this.whatsappService.isConfigured() };
  }

  @Get('messages')
  findMessages(@Query() query: MessagesQueryDto) {
    if (query.dealId) return this.whatsappService.findForDeal(query.dealId);
    if (query.contractorId) return this.whatsappService.findForContractor(query.contractorId);
    throw new BadRequestException('Укажите contractorId или dealId');
  }

  @Post('messages')
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return this.whatsappService.send(dto, user);
  }

  @Get('unmatched')
  findUnmatched() {
    return this.whatsappService.findUnmatched();
  }

  @Post('unmatched/:chatId/link')
  linkUnmatched(@Param('chatId') chatId: string, @Body() dto: LinkUnmatchedDto) {
    return this.whatsappService.linkUnmatched(chatId, dto);
  }

  @Get('templates')
  findTemplates(@Query('activeOnly') activeOnly?: string) {
    return this.whatsappService.findTemplates(activeOnly === 'true');
  }

  @Post('templates')
  @Roles('ADMIN')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.whatsappService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @Roles('ADMIN')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.whatsappService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Roles('ADMIN')
  async removeTemplate(@Param('id') id: string) {
    await this.whatsappService.removeTemplate(id);
    return { ok: true };
  }
}
