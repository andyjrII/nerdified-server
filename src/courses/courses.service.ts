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

  async getDetails(id: number): Promise<string> {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    return course.details;
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
    pdf: Express.Multer.File,
  ): Promise<Course | undefined> {
    const courseExist = await this.prisma.course.findUnique({
      where: { title: dto.title },
    });
    if (courseExist)
      throw new ConflictException('Course with title already exists!');

    // Upload the PDF to Cloudinary
    const pdfUploadResult = await this.uploadFileToCloudinary(pdf);
    if (!pdfUploadResult || !pdfUploadResult.secure_url)
      throw new BadRequestException('PDF upload failed');

    const course = await this.prisma.course.create({
      data: {
        title: dto.title,
        price: dto.price,
        details: pdfUploadResult.secure_url,
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
    pdf: Express.Multer.File,
  ): Promise<Course | undefined> {
    let pdfUploadResult: UploadApiResponse;

    // check if course exists
    const courseExist = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!courseExist) throw new NotFoundException('Course not found');

    // If a new PDF is provided, delete the old one and upload the new one
    if (pdf) {
      if (courseExist.details) {
        // Extract the public ID of the old PDF from its URL
        const publicId = this.extractPublicIdFromUrl(courseExist.details);
        await this.deleteFileFromCloudinary(publicId); // Delete the old PDF
      }

      // Upload the new PDF to Cloudinary
      pdfUploadResult = await this.uploadFileToCloudinary(pdf);
      if (!pdfUploadResult || !pdfUploadResult.secure_url) {
        throw new BadRequestException('PDF upload failed');
      }
    }

    // Only update fields that are present in the DTO or uploaded
    const updatedCourseData = {
      price: dto.price || undefined, // Only update if price is sent
      title: dto.title || undefined, // Only update if title is sent
      details: pdfUploadResult?.secure_url || courseExist.details, // Update if a new PDF is uploaded
    };

    // Update the course with the new data
    const updatedCourse = await this.prisma.course.update({
      where: { id },
      data: updatedCourseData,
    });

    if (updatedCourse) return updatedCourse;
    return undefined;
  }

  async deleteCourse(id: number): Promise<Course | undefined> {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (course.details) {
      // Extract the public ID of the PDF from its URL & delete the pdf file
      const publicId = this.extractPublicIdFromUrl(course.details);
      await this.deleteFileFromCloudinary(publicId);
    }
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

  /*
   * Cloudinary Functions
   */

  async uploadFileToCloudinary(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nerdified/courses',
          public_id: file.originalname,
          resource_type: 'raw',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        },
      );

      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });
  }

  async deleteFileFromCloudinary(publicId: string): Promise<void> {
    try {
      const fullPublicId = `nerdified/courses/${publicId}`;

      const result = await cloudinary.uploader.destroy(fullPublicId, {
        resource_type: 'raw', // Ensure 'raw' resource type for PDFs
      });

      if (result.result !== 'ok') {
        throw new Error(
          `Failed to delete pdf with publicId: ${fullPublicId}, reason: ${result.result}`,
        );
      }
    } catch (error) {
      throw new Error(`Unable to delete pdf from Cloudinary`);
    }
  }

  private extractPublicIdFromUrl(url: string): string {
    const segments = url.split('/');
    const fileName = segments.pop(); // file name with extension

    return fileName;
  }
}
