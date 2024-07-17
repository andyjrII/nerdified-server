import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(dto: CreateReviewDto) {
    return this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        student: {
          connect: { id: dto.studentId },
        },
        course: {
          connect: { id: dto.courseId },
        },
      },
    });
  }

  async getCourseReviews(courseId: number) {
    return this.prisma.review.findMany({
      where: { courseId },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        student: true,
        course: true,
      },
    });
  }
}
