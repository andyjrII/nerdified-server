import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WishListDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

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

  async getWishlistNumber(studentId: number) {
    return this.prisma.wishlist.count({
      where: { studentId },
    });
  }
}
