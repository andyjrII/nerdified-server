import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseEnrollment, Student } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseEnrollmentDto } from './dto/course-enrollment.dto';
import { formatCurrency } from '../common/utils/formatCurrency';
import { UploadApiResponse } from 'cloudinary';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudent(email: string): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: { email },
      include: {
        wishlist: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found!');
    return student;
  }

  async getStudentId(email: string): Promise<number> {
    const student = await this.prisma.student.findUnique({
      where: { email },
    });
    return student.id;
  }

  async courseEnrollment(dto: CourseEnrollmentDto): Promise<CourseEnrollment> {
    const studentId = await this.getStudentId(dto.email);
    const enrollment = await this.prisma.courseEnrollment.create({
      data: {
        studentId,
        courseId: dto.courseId,
        paidAmount: dto.amount,
        reference: dto.reference,
        preferredTime: dto.preferredTime,
        mode: dto.mode,
        classDays: dto.classDays,
        sessionsPerWeek: dto.classDays.length,
      },
    });
    if (enrollment) return enrollment;
  }

  async coursesEnrolled(email: string): Promise<CourseEnrollment[]> {
    const id = await this.getStudentId(email);
    const enrolled = await this.prisma.courseEnrollment.findMany({
      where: {
        studentId: id,
      },
      include: {
        course: true,
      },
    });
    return enrolled;
  }

  async courseAlreadyEnrolled(courseId: number): Promise<CourseEnrollment> {
    const isCourseEnrolled = await this.prisma.courseEnrollment.findFirst({
      where: {
        courseId,
      },
    });
    if (isCourseEnrolled) return isCourseEnrolled;
  }

  async totalEnrolled(email: string): Promise<Number> {
    const student = await this.prisma.student.findUnique({ where: { email } });
    return await this.prisma.courseEnrollment.count({
      where: { studentId: student.id },
    });
  }

  async totalPaidByStudentEmail(email: string): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: { email },
      include: {
        courses: {
          select: {
            paidAmount: true,
          },
        },
      },
    });

    if (!student) throw new Error('Student not found');

    const totalPaidAmount = student.courses.reduce((acc, course) => {
      return acc + course.paidAmount.toNumber();
    }, 0);

    return formatCurrency(totalPaidAmount);
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

  async getImages(emails: string[]): Promise<string[]> {
    const students = await this.prisma.student.findMany({
      where: {
        email: {
          in: emails,
        },
      },
      select: {
        imagePath: true,
      },
    });
    return students.map((student) => student.imagePath);
  }

  async getImageById(id: number): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: {
        id,
      },
    });
    return student.imagePath;
  }

  async getImageByPath(imageUrl: string): Promise<string> {
    const student = await this.prisma.student.findFirst({
      where: { imagePath: imageUrl },
    });
    return student.imagePath;
  }

  async getStudents(page: number, search: string): Promise<Object> {
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
        },
        skip: 20 * (page - 1),
        take: 20,
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

  async uploadImageToCloudinary(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    return await cloudinary.uploader.upload(file.path, {
      folder: 'nerdified/students',
      public_id: file.filename,
      resource_type: 'image',
    });
  }
}
