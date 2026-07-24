import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Query() query: NotificationQueryDto, @CurrentUser() user: AuthUser) {
    return this.notificationsService.list(user, query.unreadOnly);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getPreferences(user);
  }

  @Patch('preferences')
  setPreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.setPreferences(user, dto);
  }

  @Get('settings')
  @Roles('ADMIN', 'DIRECTOR')
  getSettings() {
    return this.notificationsService.getSettings();
  }

  @Patch('settings')
  @Roles('ADMIN')
  updateSettings(@Body() dto: UpdateNotificationSettingsDto) {
    return this.notificationsService.updateSettings(dto);
  }
}
