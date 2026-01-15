import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, ATStrategy],
  exports: [MessagesService],
})
export class MessagesModule {}
