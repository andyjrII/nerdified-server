import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  providers: [AdminService, ATStrategy],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
