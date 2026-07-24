import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { GenerateTransportRequestDto } from './dto/generate-transport-request.dto';
import { RequestGeneratorService } from './request-generator.service';

@Controller('documents/requests')
@Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
export class RequestsController {
  constructor(private readonly requestGeneratorService: RequestGeneratorService) {}

  @Post(':transportationId/legs/:legId')
  async generate(
    @Param('transportationId') transportationId: string,
    @Param('legId') legId: string,
    @Body() dto: GenerateTransportRequestDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.requestGeneratorService.generateForLeg(
      transportationId,
      legId,
      dto,
      user,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }
}
