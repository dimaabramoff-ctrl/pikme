import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List current user notifications' })
  list(@CurrentUser() user: AuthenticatedRequest['user']) {
    return this.notificationsService.listForUser(user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  unreadCount(@CurrentUser() user: AuthenticatedRequest['user']) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(user.id, notificationId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: AuthenticatedRequest['user']) {
    return this.notificationsService.markAllRead(user.id);
  }
}