import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  async createReview(@Body() createReviewDto: CreateReviewDto) {
    console.log('Called');
    return this.reviewsService.createReview(createReviewDto);
  }

  @Get('course/:courseId')
  async getCourseReviews(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.reviewsService.getCourseReviews(courseId);
  }
}
