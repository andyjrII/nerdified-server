import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Course, CourseEnrollment, LEVEL } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CourseEnrollmentSearchDto } from './dto/enrollment-search.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async getCourses(
    page: number,
    search: string,
    level: LEVEL,
  ): Promise<Object> {
    if (!level) level = undefined;
    const [courses, totalCourses] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          OR: [
            {
              title: { contains: search, mode: 'insensitive' },
            },
          ],
          level:
            level !== 'BEGINNER' || 'INTERMEDIATE' || 'ADVANCE'
              ? level
              : undefined,
        },
        skip: (page - 1) * 20,
        take: 20,
        orderBy: {
          deadline: 'asc',
        },
      }),
      this.prisma.course.count({}),
    ]);
    return { courses, totalCourses };
  }

  async getCourseById(id: number): Promise<Course> {
    return await this.prisma.course.findUnique({
      where: { id },
    });
  }

  async getOutline(id: number): Promise<string> {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    return course.outlinePath;
  }

  async uploadDocument(
    id: number,
    documentPath: string,
  ): Promise<Course | undefined> {
    const course = await this.prisma.course.update({
      where: { id },
      data: { outlinePath: documentPath },
    });
    return course;
  }

  async createCourse(dto: CreateCourseDto): Promise<Course | undefined> {
    const courseExist = await this.prisma.course.findUnique({
      where: { title: dto.title },
    });
    if (courseExist)
      throw new BadRequestException('Course with title already exists!');

    const course = await this.prisma.course.create({
      data: {
        title: dto.title,
        price: dto.price,
        level: dto.level,
        deadline: new Date(dto.deadline),
        description: dto.description,
      },
    });
    if (course) return course;
    return undefined;
  }

  async getCourseTitlesAndIds() {
    const courses = await this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        title: 'asc',
      },
    });
    return courses;
  }

  async updateCourse(
    id: number,
    dto: UpdateCourseDto,
  ): Promise<Course | undefined> {
    const courseExist = await this.prisma.course.findUnique({
      where: { id, title: dto.title },
    });
    if (courseExist) dto.title = undefined;

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        price: dto.price || undefined,
        title: dto.title || undefined,
        description: dto.description || undefined,
        deadline: dto.deadline || undefined,
        level: dto.level || undefined,
      },
    });

    if (course) return course;
    return undefined;
  }

  async deleteCourse(id: number): Promise<Course | undefined> {
    return await this.prisma.course.delete({
      where: { id },
    });
  }

  async coursePayments(
    page: number,
    dto: CourseEnrollmentSearchDto,
  ): Promise<Object> {
    const where = {};
    if (dto.search) {
      where['course'] = {
        title: {
          contains: dto.search,
          mode: 'insensitive',
        },
      };
    }

    if (dto.status) {
      where['status'] = {
        equals: dto.status,
      };
    }

    const [payments, totalPayments] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where,
        include: {
          student: true,
          course: true,
        },
        skip: 30 * (page - 1),
        take: 30,
        orderBy: {
          dateEnrolled: 'asc',
        },
      }),
      await this.prisma.courseEnrollment.count({}),
    ]);
    return { payments, totalPayments };
  }

  async courseStatusUpdate(
    page: number,
    dto: UpdateStatusDto,
  ): Promise<CourseEnrollment[] | undefined> {
    await this.prisma.courseEnrollment.updateMany({
      where: {
        courseId: dto.courseId,
      },
      data: {
        status: dto.status,
      },
    });
    return await this.prisma.courseEnrollment.findMany({
      skip: 30 * (page - 1),
      take: 30,
      orderBy: {
        dateEnrolled: 'asc',
      },
      include: {
        student: true,
        course: true,
      },
    });
  }

  async latestCourses(): Promise<Course[] | undefined> {
    const courses = await this.prisma.course.findMany({
      orderBy: {
        deadline: 'asc',
      },
      take: 4,
    });
    return courses;
  }
}
