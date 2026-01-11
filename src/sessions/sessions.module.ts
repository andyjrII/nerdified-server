import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  providers: [SessionsService, ATStrategy],
  exports: [SessionsService],
})
export class SessionsModule {}
