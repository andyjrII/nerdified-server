import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WishListDto } from './dto/wishlist.dto';
import { StudentsService } from '../students/students.service';

@Injectable()
export class WishlistService {
  constructor(
    private prisma: PrismaService,
    private readonly studentsService: StudentsService,
  ) {}

  async addToWishlist(dto: WishListDto) {
    return this.prisma.wishlist.create({
      data: {
        studentId: dto.studentId,
        courseId: dto.courseId,
      },
    });
  }

  async removeFromWishlist(dto: WishListDto) {
    return this.prisma.wishlist.deleteMany({
      where: {
        studentId: dto.studentId,
        courseId: dto.courseId,
      },
    });
  }

  async getWishlist(studentId: number) {
    return this.prisma.wishlist.findMany({
      where: { studentId },
      include: { course: true },
    });
  }

  async getWishlistNumber(email: string): Promise<number> {
    const studentId = await this.studentsService.getIdByEmail(email);
    return this.prisma.wishlist.count({
      where: { studentId },
    });
  }
}
