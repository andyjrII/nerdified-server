import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
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
  constructor(
    private prisma: PrismaService,
    private sessionsService: SessionsService,
  ) {}

  async getCourses(page: number, search: string): Promise<Object> {
    const [courses, totalCourses] = await Promise.all([
      this.prisma.course.findMany({
        where: {
          status: 'PUBLISHED',
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
      this.prisma.course.count({ where: { status: 'PUBLISHED' } }),
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
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!course || course.status !== 'PUBLISHED')
      throw new NotFoundException('Course not found');
    return course;
  }

  async getDetails(id: number): Promise<string | null> {
    const course = await this.prisma.course.findUnique({
      where: { id, status: 'PUBLISHED' },
      select: { curriculum: true },
    });
    return course?.curriculum || null;
  }

  async getLatestCourses(): Promise<any[]> {
    const courses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED' },
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

  /**
   * Featured courses = top-rated with at least minReviewCount reviews.
   * Only published courses. Used for the home page.
   */
  async getFeaturedCourses(
    limit = 6,
    minReviewCount = 1,
  ): Promise<
    Array<{
      id: number;
      title: string;
      description: string | null;
      price: string;
      updatedAt: Date;
      averageRating: number;
      reviewCount: number;
    }>
  > {
    const courses = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        review: { select: { rating: true } },
      },
    });

    const withRating = courses
      .map((course) => {
        const count = course.review.length;
        const averageRating =
          count > 0
            ? course.review.reduce((acc, r) => acc + r.rating, 0) / count
            : 0;
        return {
          ...course,
          reviewCount: count,
          averageRating: Math.round(averageRating * 10) / 10,
        };
      })
      .filter((c) => c.reviewCount >= minReviewCount)
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit);

    return withRating.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      price: formatCurrency(course.price.toNumber()),
      updatedAt: course.updatedAt,
      averageRating: course.averageRating,
      reviewCount: course.reviewCount,
    }));
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

    // Fetch course details for the top courses (only published)
    const courses = await this.prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
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
        status: 'DRAFT',
      },
    });
    if (course) return course;
    return undefined;
  }

  /** For tutors: get own course by id (any status), with sessions. */
  async getCourseByIdForTutor(
    courseId: number,
    tutorId: number,
  ): Promise<Course & { sessions: Array<{ id: number; title: string | null; startTime: Date; endTime: Date; status: string }> }> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tutorId },
      include: {
        sessions: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { startTime: 'asc' },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course as Course & { sessions: Array<{ id: number; title: string | null; startTime: Date; endTime: Date; status: string }> };
  }

  /** Publish course. Only when DRAFT, tutor owns it, and has at least one session. */
  async publishCourse(courseId: number, tutorId: number): Promise<Course> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tutorId },
      include: { sessions: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status === 'PUBLISHED')
      throw new BadRequestException('Course is already published');
    if (!course.sessions?.length)
      throw new BadRequestException(
        'Add at least one session before publishing the course',
      );
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'PUBLISHED' },
    });
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
    if (dto.status === 'STARTED') {
      await this.sessionsService.createBookingsForEnrolledStudents(dto.courseId);
    }
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
