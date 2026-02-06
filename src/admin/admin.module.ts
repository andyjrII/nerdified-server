import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [SessionsModule],
  providers: [AdminService, ATStrategy],
  controllers: [AdminController],
})
export class AdminModule {}
