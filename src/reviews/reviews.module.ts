import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { StudentsModule } from '../students/students.module';

@Module({
  providers: [ReviewsService],
  controllers: [ReviewsController],
  imports: [StudentsModule],
})
export class ReviewsModule {}
