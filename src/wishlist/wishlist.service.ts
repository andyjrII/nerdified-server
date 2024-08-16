import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WishListDto } from './dto/wishlist.dto';
import { StudentsService } from '../students/students.service';
import { Wishlist } from '@prisma/client';

@Injectable()
export class WishlistService {
  constructor(
    private prisma: PrismaService,
    private readonly studentsService: StudentsService,
  ) {}

  async addToWishlist(dto: WishListDto) {
    const studentId = await this.studentsService.getIdByEmail(dto.email);
    return this.prisma.wishlist.create({
      data: {
        studentId,
        courseId: dto.courseId,
      },
    });
  }

  async removeFromWishlist(dto: WishListDto) {
    const studentId = await this.studentsService.getIdByEmail(dto.email);
    return this.prisma.wishlist.deleteMany({
      where: {
        studentId,
        courseId: dto.courseId,
      },
    });
  }

  async getWishlistById(studentId: number): Promise<Wishlist[]> {
    return await this.prisma.wishlist.findMany({
      where: { studentId },
      include: { course: true },
    });
  }

  async getWishlistByEmail(email: string): Promise<any[]> {
    const studentId = await this.studentsService.getIdByEmail(email);

    // Step 1: Fetch wishlist with course details
    const wishlist = await this.prisma.wishlist.findMany({
      where: { studentId },
      include: { course: true },
    });

    // Step 2: Fetch average ratings for the courses in the wishlist
    const courseIds = wishlist.map((item) => item.courseId);
    const ratings = await this.prisma.review.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds } },
      _avg: { rating: true },
    });

    // Step 3: Merge the average ratings with the wishlist
    return wishlist.map((item) => {
      const courseRating = ratings.find((r) => r.courseId === item.courseId);
      return {
        ...item,
        course: {
          ...item.course,
          averageRating: courseRating?._avg?.rating || 0,
        },
      };
    });
  }

  async getWishlistNumber(email: string): Promise<number> {
    const studentId = await this.studentsService.getIdByEmail(email);
    return this.prisma.wishlist.count({
      where: { studentId },
    });
  }
}
