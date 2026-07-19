import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponse, UsersService } from './users.service';

@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<UserResponse[]> {
    return this.usersService.findAll();
  }

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserResponse> {
    return this.usersService.create(dto, actor.id);
  }

  @Patch(':id/password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserResponse> {
    return this.usersService.resetPassword(id, dto.password, actor.id);
  }

  @Patch(':id/deactivate')
  deactivate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserResponse> {
    if (id === actor.id) {
      throw new BadRequestException(
        'Нельзя деактивировать собственную учётную запись',
      );
    }
    return this.usersService.setActive(id, false, actor.id);
  }

  @Patch(':id/activate')
  activate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserResponse> {
    return this.usersService.setActive(id, true, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserResponse> {
    return this.usersService.update(id, dto, actor.id);
  }
}
