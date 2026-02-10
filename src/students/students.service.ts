import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseEnrollment, Student } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseEnrollmentDto } from './dto/course-enrollment.dto';
import { formatCurrency } from '../common/utils/formatCurrency';
import { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../cloudinary/cloudinary.provider';
import { Readable } from 'stream';

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
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.courseType === 'BOTH' && !dto.deliveryMode) {
      throw new BadRequestException('deliveryMode (GROUP or ONE_ON_ONE) is required when course offers both');
    }
    const studentId = await this.getStudentId(dto.email);
    const enrollment = await this.prisma.courseEnrollment.create({
      data: {
        studentId,
        courseId: dto.courseId,
        paidAmount: dto.amount,
        reference: dto.reference,
        deliveryMode: dto.deliveryMode ?? null,
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
    newImage: Express.Multer.File,
  ): Promise<string> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { imagePath: true },
    });

    // Extract the public ID of the old image from its URL
    if (student?.imagePath) {
      const publicId = this.extractPublicIdFromUrl(student.imagePath);
      await this.deleteFileFromCloudinary(publicId); // Delete the old image
    }

    // Upload the new image to Cloudinary
    const uploadResult = await this.uploadImageToCloudinary(newImage);
    if (!uploadResult || !uploadResult.secure_url) {
      throw new BadRequestException('Image upload failed');
    }

    // Update the student's record with the new image URL
    await this.prisma.student.update({
      where: { id },
      data: { imagePath: uploadResult.secure_url },
    });

    return uploadResult.secure_url;
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
          folder: 'nerdified/students',
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
      const fullPublicId = `nerdified/students/${publicId}`; // Ensure correct full publicId
      const result = await cloudinary.uploader.destroy(fullPublicId, {
        resource_type: 'image',
      });

      if (result.result !== 'ok') {
        throw new Error(
          `Failed to delete image with publicId: ${fullPublicId}, reason: ${result.result}`,
        );
      }
    } catch (error) {
      throw new Error(`Unable to delete image from Cloudinary`);
    }
  }

  private extractPublicIdFromUrl(url: string): string {
    // Assuming the URL has the format:
    // "https://res.cloudinary.com/{cloud_name}/image/upload/v1234567890/folder_name/public_id.extension"
    const segments = url.split('/');
    const fileName = segments.pop(); // file name with extension

    // Remove the extension from the file name if multiple extensions are present
    const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.');

    return fileNameWithoutExtension;
  }
}
