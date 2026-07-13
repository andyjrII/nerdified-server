import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AtGuard } from '../common/guards/at.guard';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { JwtPayload } from '../auth/strategies/at.strategy';

@UseGuards(AtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @GetCurrentUser() user: JwtPayload,
    @Query('page') page?: string,
  ) {
    return this.notificationsService.list(user, page ? Number(page) : 1);
  }

  @Get('unread-count')
  async unreadCount(@GetCurrentUser() user: JwtPayload) {
    return this.notificationsService.unreadCount(user);
  }

  @Patch('read-all')
  async markAllRead(@GetCurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markRead(id, user);
  }
}
