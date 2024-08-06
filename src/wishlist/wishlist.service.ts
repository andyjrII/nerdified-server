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

  async getWishlistById(studentId: number) {
    return this.prisma.wishlist.findMany({
      where: { studentId },
      include: { course: true },
    });
  }

  async getWishlistByEmail(email: string): Promise<Wishlist[]> {
    const studentId = await this.studentsService.getIdByEmail(email);
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
