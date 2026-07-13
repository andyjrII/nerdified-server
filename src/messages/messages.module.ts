import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesGateway } from './messages.gateway';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, ATStrategy],
  exports: [MessagesService],
})
export class MessagesModule {}
