import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WishListDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async addToWishlist(addToWishlistDto: WishListDto) {
    return this.prisma.wishlist.create({
      data: {
        studentId: addToWishlistDto.studentId,
        courseId: addToWishlistDto.courseId,
      },
    });
  }

  async removeFromWishlist(removeFromWishlistDto: WishListDto) {
    return this.prisma.wishlist.deleteMany({
      where: {
        studentId: removeFromWishlistDto.studentId,
        courseId: removeFromWishlistDto.courseId,
      },
    });
  }

  async getWishlist(studentId: number) {
    return this.prisma.wishlist.findMany({
      where: { studentId },
      include: { course: true },
    });
  }
}
