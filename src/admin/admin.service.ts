import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Admin, ROLE } from '@prisma/client';
import { CreateAdminDto } from './dto/create-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPosts(
    page: number,
    search: string,
    startDate: string,
    endDate: string,
  ): Promise<Object> {
    const [posts, totalPosts] = await Promise.all([
      await this.prisma.blog.findMany({
        where: {
          OR: [
            {
              title: { contains: search, mode: 'insensitive' },
            },
          ],
          datePosted: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
        skip: 20 * (page - 1),
        take: 20,
      }),
      this.prisma.blog.count({}),
    ]);
    return { posts, totalPosts };
  }

  async getTotal(): Promise<Number[]> {
    const totalStudents = await this.prisma.student.count({});
    const totalCourses = await this.prisma.course.count({});
    const totalPosts = await this.prisma.blog.count({});

    return [totalStudents, totalCourses, totalPosts];
  }

  async getPaymentsByMonth(): Promise<any[]> {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      select: {
        dateEnrolled: true,
        paidAmount: true,
      },
    });

    // Calculate sums by month/year
    const payments = enrollments.reduce((acc, enrollment) => {
      const date = new Date(enrollment.dateEnrolled);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1; // Adding 1 since getUTCMonth() is 0-based

      const key = `${month}/${year}`;

      if (!acc[key]) {
        acc[key] = 0;
      }

      acc[key] += parseFloat(enrollment.paidAmount.toString());

      return acc;
    }, {});

    // Convert the sums to the desired format
    const result = Object.entries(payments).map(([key, sum]) => ({
      month: key,
      sumOfPaidAmount: sum,
    }));

    return result;
  }

  async getAdmin(email: string): Promise<Admin> {
    return await this.prisma.admin.findUnique({
      where: { email },
    });
  }

  // Super Admin Endpoint

  async createAdmin(dto: CreateAdminDto): Promise<Admin> {
    if (dto.role !== 'SUPER') throw new UnauthorizedException();
    const password = await this.hashData(dto.password);
    const checkAdmin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (checkAdmin) throw new BadRequestException('Admin already exists!');
    return await this.prisma.admin.create({
      data: {
        email: dto.email,
        password,
        name: dto.name,
      },
    });
  }

  async getAdmins(page: number, search: string, role: ROLE): Promise<Object> {
    if (role !== 'SUPER') throw new UnauthorizedException();
    const [admins, totalAdmins] = await Promise.all([
      await this.prisma.admin.findMany({
        where: {
          OR: [
            {
              name: { contains: search, mode: 'insensitive' },
            },
            {
              email: { contains: search, mode: 'insensitive' },
            },
          ],
        },
        skip: 20 * (page - 1),
        take: 20,
        orderBy: {
          id: 'asc',
        },
      }),
      this.prisma.admin.count({}),
    ]);
    return { admins, totalAdmins };
  }

  async deleteAdmin(id: number, role: ROLE): Promise<Admin | undefined> {
    if (role !== 'SUPER') throw new UnauthorizedException();
    return await this.prisma.admin.delete({
      where: { id },
    });
  }

  hashData(data: string) {
    return bcrypt.hash(data, 10);
  }
}
