import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session, TutorAvailability } from '@prisma/client';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAvailability(
    tutorId: number,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
  ): Promise<TutorAvailability> {
    return await this.prisma.tutorAvailability.create({
      data: {
        tutorId,
        dayOfWeek: dayOfWeek as any,
        startTime,
        endTime,
        isAvailable: true,
      },
    });
  }

  async getTutorAvailability(tutorId: number): Promise<TutorAvailability[]> {
    return await this.prisma.tutorAvailability.findMany({
      where: {
        tutorId,
        isAvailable: true,
      },
    });
  }

  async createSession(
    courseId: number,
    tutorId: number,
    startTime: Date,
    endTime: Date,
    title?: string,
    description?: string,
  ): Promise<Session> {
    // Validate that the course belongs to the tutor
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        tutorId,
      },
    });

    if (!course) {
      throw new NotFoundException(
        'Course not found or does not belong to this tutor',
      );
    }

    return await this.prisma.session.create({
      data: {
        courseId,
        tutorId,
        startTime,
        endTime,
        title,
        description,
        status: 'SCHEDULED',
      },
    });
  }

  async getSessionsByCourse(courseId: number): Promise<Session[]> {
    return await this.prisma.session.findMany({
      where: {
        courseId,
      },
      include: {
        bookings: true,
        attendance: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  async getSessionsByTutor(tutorId: number): Promise<Session[]> {
    return await this.prisma.session.findMany({
      where: {
        tutorId,
      },
      include: {
        course: true,
        bookings: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }
}
