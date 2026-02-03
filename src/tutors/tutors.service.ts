import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Tutor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../cloudinary/cloudinary.provider';
import { Readable } from 'stream';

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTutor(email: string): Promise<Tutor | undefined> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { email },
      include: {
        courses: true,
      },
    });
    if (!tutor) throw new NotFoundException('Tutor not found!');
    return tutor;
  }

  async getTutorById(id: number): Promise<Tutor | undefined> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id },
      include: {
        courses: true,
        availability: true,
      },
    });
    if (!tutor) throw new NotFoundException('Tutor not found!');
    return tutor;
  }

  /**
   * Get earnings summary and enrollments for the tutor's courses
   */
  async getEarnings(tutorId: number): Promise<{
    totalEarnings: number;
    totalEnrollments: number;
    byCourse: Array<{ courseId: number; title: string; count: number; revenue: number }>;
    recentEnrollments: Array<{
      id: number;
      paidAmount: number;
      dateEnrolled: Date;
      status: string;
      course: { id: number; title: string };
      student: { id: number; name: string; email: string };
    }>;
  }> {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        course: { tutorId },
      },
      include: {
        course: { select: { id: true, title: true } },
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dateEnrolled: 'desc' },
    });

    let totalEarnings = 0;
    const byCourseMap = new Map<
      number,
      { title: string; count: number; revenue: number }
    >();

    for (const e of enrollments) {
      const amount = Number(e.paidAmount);
      totalEarnings += amount;
      const existing = byCourseMap.get(e.courseId);
      if (existing) {
        existing.count += 1;
        existing.revenue += amount;
      } else {
        byCourseMap.set(e.courseId, {
          title: e.course.title,
          count: 1,
          revenue: amount,
        });
      }
    }

    const byCourse = Array.from(byCourseMap.entries()).map(
      ([courseId, data]) => ({
        courseId,
        title: data.title,
        count: data.count,
        revenue: data.revenue,
      }),
    );

    const recentEnrollments = enrollments.slice(0, 10).map((e) => ({
      id: e.id,
      paidAmount: Number(e.paidAmount),
      dateEnrolled: e.dateEnrolled,
      status: e.status,
      course: e.course,
      student: e.student,
    }));

    return {
      totalEarnings,
      totalEnrollments: enrollments.length,
      byCourse,
      recentEnrollments,
    };
  }

  /**
   * Get unique students enrolled in the tutor's courses
   */
  async getStudents(tutorId: number): Promise<
    Array<{
      studentId: number;
      name: string;
      email: string;
      coursesEnrolled: number;
      totalPaid: number;
      lastEnrolled: Date;
    }>
  > {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        course: { tutorId },
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dateEnrolled: 'desc' },
    });

    const studentMap = new Map<
      number,
      { name: string; email: string; coursesEnrolled: number; totalPaid: number; lastEnrolled: Date }
    >();

    for (const e of enrollments) {
      const amount = Number(e.paidAmount);
      const existing = studentMap.get(e.studentId);
      if (existing) {
        existing.coursesEnrolled += 1;
        existing.totalPaid += amount;
        if (e.dateEnrolled > existing.lastEnrolled) {
          existing.lastEnrolled = e.dateEnrolled;
        }
      } else {
        studentMap.set(e.studentId, {
          name: e.student.name,
          email: e.student.email,
          coursesEnrolled: 1,
          totalPaid: amount,
          lastEnrolled: e.dateEnrolled,
        });
      }
    }

    return Array.from(studentMap.entries()).map(([studentId, data]) => ({
      studentId,
      name: data.name,
      email: data.email,
      coursesEnrolled: data.coursesEnrolled,
      totalPaid: data.totalPaid,
      lastEnrolled: data.lastEnrolled,
    }));
  }

  async getTutorId(email: string): Promise<number> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { email },
    });
    if (!tutor) throw new NotFoundException('Tutor not found!');
    return tutor.id;
  }

  async updateTimezone(tutorId: number, timezone: string): Promise<Tutor> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
    });
    if (!tutor) throw new NotFoundException('Tutor not found');
    return this.prisma.tutor.update({
      where: { id: tutorId },
      data: { timezone },
    });
  }

  /*
   * Cloudinary Functions
   */

  async uploadImageToCloudinary(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    // Check if Cloudinary is configured
    if (!process.env.CLOUD_NAME || !process.env.API_KEY || !process.env.API_SECRET) {
      throw new Error(
        'Cloudinary credentials are not configured. Please set CLOUD_NAME, API_KEY, and API_SECRET in your .env file.',
      );
    }

    console.log('Uploading to Cloudinary:', {
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      cloud_name: process.env.CLOUD_NAME,
    });

    return new Promise((resolve, reject) => {
      // Set a timeout of 60 seconds (matching Cloudinary config)
      const timeout = setTimeout(() => {
        reject(
          new Error(
            'Cloudinary upload timeout after 60 seconds. This could be due to:\n' +
              '1. Network connectivity issues\n' +
              '2. Incorrect Cloudinary credentials\n' +
              '3. Firewall/proxy blocking the connection\n' +
              '4. Large file size or slow network\n' +
              'Please verify your Cloudinary credentials in .env and check your network connection.',
          ),
        );
      }, 60000); // 60 seconds

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nerdified/tutors',
          public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, '')}`, // Add timestamp to avoid conflicts
          resource_type: 'image',
          chunk_size: 6000000, // 6MB chunks for better reliability
        },
        (error, result) => {
          clearTimeout(timeout);
          if (error) {
            console.error('Cloudinary upload error details:', {
              message: error.message,
              http_code: error.http_code,
              name: error.name,
              error: error,
            });
            
            let errorMessage = 'Cloudinary upload failed';
            if (error.http_code === 401) {
              errorMessage = 'Cloudinary authentication failed. Please check your API_KEY and API_SECRET.';
            } else if (error.http_code === 404) {
              errorMessage = 'Cloudinary cloud not found. Please check your CLOUD_NAME.';
            } else if (error.http_code === 499 || error.name === 'TimeoutError') {
              errorMessage = 
                'Cloudinary connection timeout. This could be due to:\n' +
                '1. Network connectivity issues\n' +
                '2. Firewall/proxy blocking Cloudinary\n' +
                '3. Incorrect Cloudinary credentials\n' +
                '4. Slow network connection';
            } else if (error.message) {
              errorMessage = `Cloudinary upload failed: ${error.message}`;
            }
            
            reject(new Error(errorMessage));
          } else if (!result) {
            reject(new Error('Cloudinary upload failed: No result returned'));
          } else {
            console.log('Cloudinary upload successful:', result.secure_url);
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
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException('Failed to delete image from cloudinary');
    }
  }
}
