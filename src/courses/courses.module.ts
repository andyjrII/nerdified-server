import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  providers: [CoursesService, ATStrategy],
  controllers: [CoursesController],
})
export class CoursesModule {}
