import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateDocumentContactDto } from './dto/update-document-contact.dto';
import { UsersService } from './users.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getOwnProfile(@CurrentUser() user: AuthUser) {
    return this.usersService.getOwnDocumentContact(user.id);
  }

  @Patch('document-contact')
  updateOwnDocumentContact(
    @Body() dto: UpdateDocumentContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.updateOwnDocumentContact(user.id, dto);
  }
}
