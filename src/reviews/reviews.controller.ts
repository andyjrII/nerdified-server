import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { AtGuard } from '../common/guards/at.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @UseGuards(AtGuard)
  @Post()
  async createReview(@Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(dto);
  }

  @Public()
  @Get('course/:courseId')
  async getCourseReviews(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.reviewsService.getCourseReviews(courseId);
  }
}
