import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContractGeneratorService } from './contract-generator.service';
import {
  GenerateContractForContractorDto,
  GenerateContractForDealDto,
} from './dto/generate-contract.dto';

@Controller('documents/contracts')
export class ContractsController {
  constructor(private readonly contractGeneratorService: ContractGeneratorService) {}

  @Post('deal/:dealId')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER')
  async generateForDeal(
    @Param('dealId') dealId: string,
    @Body() dto: GenerateContractForDealDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.contractGeneratorService.generateForDeal(
      dealId,
      dto.overrides,
      user,
    );
    this.sendDocx(res, buffer, filename);
  }

  @Post('contractor/:contractorId')
  @Roles('ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST')
  async generateForContractor(
    @Param('contractorId') contractorId: string,
    @Body() dto: GenerateContractForContractorDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.contractGeneratorService.generateForContractor(
      contractorId,
      dto.legalEntityId,
      dto.overrides,
      user,
    );
    this.sendDocx(res, buffer, filename);
  }

  private sendDocx(res: Response, buffer: Buffer, filename: string): void {
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
