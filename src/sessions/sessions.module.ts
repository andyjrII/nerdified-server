import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';
import { LivekitModule } from '../livekit/livekit.module';

@Module({
  imports: [LivekitModule],
  controllers: [SessionsController],
  providers: [SessionsService, ATStrategy],
  exports: [SessionsService],
})
export class SessionsModule {}
