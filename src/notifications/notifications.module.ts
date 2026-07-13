import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RemindersService } from './reminders.service';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, RemindersService, ATStrategy],
  exports: [NotificationsService],
})
export class NotificationsModule {}
