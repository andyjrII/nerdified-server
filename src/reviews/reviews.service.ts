import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(createReviewDto: CreateReviewDto) {
    return this.prisma.review.create({
      data: {
        rating: createReviewDto.rating,
        comment: createReviewDto.comment,
        student: {
          connect: { id: createReviewDto.studentId },
        },
        course: {
          connect: { id: createReviewDto.courseId },
        },
      },
    });
  }

  async getCourseReviews(courseId: number) {
    return this.prisma.review.findMany({
      where: { courseId },
      include: {
        student: true,
        course: true,
      },
    });
  }
}
