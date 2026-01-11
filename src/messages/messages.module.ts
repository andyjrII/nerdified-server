import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  providers: [MessagesService, ATStrategy],
  exports: [MessagesService],
})
export class MessagesModule {}
