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

  async getTutorId(email: string): Promise<number> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { email },
    });
    if (!tutor) throw new NotFoundException('Tutor not found!');
    return tutor.id;
  }

  /*
   * Cloudinary Functions
   */

  async uploadImageToCloudinary(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nerdified/tutors',
          public_id: file.originalname,
          resource_type: 'image',
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
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException('Failed to delete image from cloudinary');
    }
  }
}
