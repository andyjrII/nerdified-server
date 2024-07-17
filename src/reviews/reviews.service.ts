import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { StudentsService } from '../students/students.service';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private readonly studentsService: StudentsService,
  ) {}

  async createReview(dto: CreateReviewDto) {
    const studentId = await this.studentsService.getIdByEmail(dto.email);
    return this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        student: {
          connect: { id: studentId },
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
