import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { StudentsModule } from '../students/students.module';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  providers: [ReviewsService, ATStrategy],
  controllers: [ReviewsController],
  imports: [StudentsModule],
})
export class ReviewsModule {}
