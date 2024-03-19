import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ACADEMICLEVEL, CourseEnrollment, Student } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseEnrollmentDto } from './dto/course-enrollment.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findStudent(email: string): Promise<Student> {
    const student = await this.prisma.student.findUnique({
      where: { email: email },
    });
    if (!student) throw new NotFoundException('Student not found!');
    return student;
  }

  async courseEnrollment(dto: CourseEnrollmentDto): Promise<CourseEnrollment> {
    const student = await this.findStudent(dto.email);
    const checkEnrollment = await this.prisma.courseEnrollment.findFirst({
      where: {
        studentId: student.id,
        courseId: dto.courseId,
      },
    });
    if (checkEnrollment)
      throw new BadRequestException('Course has already been paid for!');

    const enrollment = await this.prisma.courseEnrollment.create({
      data: {
        studentId: student.id,
        courseId: dto.courseId,
        paidAmount: dto.amount,
        reference: dto.reference,
      },
    });
    if (enrollment) return enrollment;
  }

  async coursesEnrolled(email: string): Promise<CourseEnrollment[]> {
    const student = await this.findStudent(email);
    const enrolled = await this.prisma.courseEnrollment.findMany({
      where: {
        studentId: student.id,
      },
      include: {
        course: true,
      },
    });
    if (enrolled) return enrolled;
  }

  async totalEnrolled(email: string): Promise<Number> {
    const student = await this.prisma.student.findUnique({ where: { email } });
    return await this.prisma.courseEnrollment.count({
      where: { studentId: student.id },
    });
  }

  async getIdByEmail(email: string): Promise<number> {
    const student = await this.prisma.student.findUnique({
      where: { email },
    });
    return student.id;
  }

  async uploadImage(
    id: number,
    imagePath: string,
  ): Promise<Student | undefined> {
    const student = await this.prisma.student.update({
      where: { id },
      data: { imagePath },
    });
    return student;
  }

  async getImage(email: string): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: { email },
    });
    return student.imagePath;
  }

  async getImageById(id: number): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: {
        id,
      },
    });
    return student.imagePath;
  }

  async getStudents(
    page: number,
    search: string,
    academicLevel: ACADEMICLEVEL,
  ): Promise<Object> {
    if (!academicLevel) academicLevel = undefined;
    const [students, totalStudents] = await Promise.all([
      await this.prisma.student.findMany({
        where: {
          OR: [
            {
              name: { contains: search, mode: 'insensitive' },
            },
            {
              email: { contains: search, mode: 'insensitive' },
            },
          ],
          academicLevel:
            academicLevel !== 'OLEVEL' || 'ND' || 'HND' || 'BSC' || 'GRADUATE'
              ? academicLevel
              : undefined,
        },
        skip: 20 * (page - 1),
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      await this.prisma.student.count({}),
    ]);
    return { students, totalStudents };
  }

  async deleteStudent(id: number): Promise<Student | undefined> {
    return await this.prisma.student.delete({
      where: { id },
    });
  }
}
