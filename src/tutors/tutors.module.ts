import { Module } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { TutorsController } from './tutors.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  controllers: [TutorsController],
  providers: [TutorsService, ATStrategy],
  exports: [TutorsService],
})
export class TutorsModule {}
