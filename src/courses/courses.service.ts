import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Course, CourseEnrollment } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CourseEnrollmentSearchDto } from './dto/enrollment-search.dto';
import { formatCurrency } from '../common/utils/formatCurrency';
import { cloudinary } from '../cloudinary/cloudinary.provider';
import { UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async getCourses(page: number, search: string): Promise<Object> {
    const [courses, totalCourses] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          OR: [
            {
              title: { contains: search, mode: 'insensitive' },
            },
          ],
        },
        skip: (page - 1) * 20,
        take: 20,
        orderBy: {
          updatedAt: 'asc',
        },
        include: {
          review: {
            select: {
              rating: true,
            },
          },
          wishlist: true,
        },
      }),
      this.prisma.course.count({}),
    ]);

    const coursesWithAverageRating = courses.map((course) => {
      const totalRatings = course.review.length;
      const averageRating = totalRatings
        ? course.review.reduce((acc, review) => acc + review.rating, 0) /
          totalRatings
        : null;

      return {
        ...course,
        averageRating,
        price: formatCurrency(course.price.toNumber()),
      };
    });

    return { courses: coursesWithAverageRating, totalCourses };
  }

  async getCourseById(id: number): Promise<Course> {
    return await this.prisma.course.findUnique({
      where: { id },
    });
  }

  async getDetails(id: number): Promise<string | null> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      select: { curriculum: true },
    });
    return course?.curriculum || null;
  }

  async getLatestCourses(): Promise<any[]> {
    const courses = await this.prisma.course.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
      take: 4,
    });

    // Format the price for each course
    const formattedCourses = courses.map((course) => ({
      ...course,
      price: formatCurrency(course.price.toNumber()), // Assuming price is of type Decimal
    }));

    return formattedCourses;
  }

  async getTopEnrolledCourses(): Promise<any[]> {
    const topCourses = await this.prisma.courseEnrollment.groupBy({
      by: ['courseId'],
      _count: {
        courseId: true,
      },
      _max: {
        dateEnrolled: true,
      },
      orderBy: [
        {
          _count: {
            courseId: 'desc',
          },
        },
        {
          _max: {
            dateEnrolled: 'desc',
          },
        },
      ],
      take: 4,
    });

    // Fetch course details for the top courses
    const courses = await this.prisma.course.findMany({
      where: {
        id: {
          in: topCourses.map((course) => course.courseId),
        },
      },
    });

    // Format the price for each course
    const formattedCourses = courses.map((course) => ({
      ...course,
      price: formatCurrency(course.price.toNumber()), // Assuming price is of type Decimal
    }));

    return formattedCourses;
  }

  async createCourse(
    dto: CreateCourseDto,
    tutorId: number,
  ): Promise<Course | undefined> {
    // Check if course with same title exists for this tutor
    const courseExist = await this.prisma.course.findFirst({
      where: {
        tutorId,
        title: dto.title,
      },
    });
    if (courseExist)
      throw new ConflictException(
        'Course with this title already exists for this tutor!',
      );

    const course = await this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        pricingModel: dto.pricingModel || 'PER_COURSE',
        courseType: dto.courseType || 'ONE_ON_ONE',
        maxStudents: dto.maxStudents,
        curriculum: dto.curriculum,
        outcomes: dto.outcomes,
        tutorId,
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

  /*
   * Updates a course
   */
  async updateCourse(
    id: number,
    dto: UpdateCourseDto,
  ): Promise<Course | undefined> {
    // check if course exists
    const courseExist = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!courseExist) throw new NotFoundException('Course not found');

    // Only update fields that are present in the DTO
    const updatedCourseData: any = {};
    if (dto.title !== undefined) updatedCourseData.title = dto.title;
    if (dto.price !== undefined) updatedCourseData.price = dto.price;
    if (dto.description !== undefined) updatedCourseData.description = dto.description;
    if (dto.curriculum !== undefined) updatedCourseData.curriculum = dto.curriculum;
    if (dto.outcomes !== undefined) updatedCourseData.outcomes = dto.outcomes;
    if (dto.pricingModel !== undefined) updatedCourseData.pricingModel = dto.pricingModel;
    if (dto.courseType !== undefined) updatedCourseData.courseType = dto.courseType;
    if (dto.maxStudents !== undefined) updatedCourseData.maxStudents = dto.maxStudents;

    // Update the course with the new data
    const updatedCourse = await this.prisma.course.update({
      where: { id },
      data: updatedCourseData,
    });

    if (updatedCourse) return updatedCourse;
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

}
