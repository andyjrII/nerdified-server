import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session, TutorAvailability, SessionBooking } from '@prisma/client';

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

  async bookSession(
    sessionId: number,
    studentId: number,
  ): Promise<SessionBooking> {
    // Check if session exists
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        course: {
          include: {
            enrollments: true,
          },
        },
        bookings: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Check if student is enrolled in the course
    const enrollment = await this.prisma.courseEnrollment.findFirst({
      where: {
        courseId: session.courseId,
        studentId,
        status: 'STARTED',
      },
    });

    if (!enrollment) {
      throw new BadRequestException(
        'You must be enrolled in this course to book sessions',
      );
    }

    // Check if session is already booked by this student
    const existingBooking = await this.prisma.sessionBooking.findUnique({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId,
        },
      },
    });

    if (existingBooking) {
      throw new ConflictException('You have already booked this session');
    }

    // Check if session has reached max capacity (for group classes)
    if (session.course.maxStudents) {
      const bookingCount = session.bookings.filter(
        (b) => b.status === 'CONFIRMED',
      ).length;
      if (bookingCount >= session.course.maxStudents) {
        throw new BadRequestException('Session is fully booked');
      }
    }

    // Create booking
    return await this.prisma.sessionBooking.create({
      data: {
        sessionId,
        studentId,
        status: 'CONFIRMED',
      },
    });
  }

  async getStudentBookings(studentId: number): Promise<SessionBooking[]> {
    return await this.prisma.sessionBooking.findMany({
      where: {
        studentId,
      },
      include: {
        session: {
          include: {
            course: true,
            tutor: true,
          },
        },
      },
      orderBy: {
        bookedAt: 'desc',
      },
    });
  }

  async cancelBooking(
    bookingId: number,
    studentId: number,
  ): Promise<SessionBooking> {
    const booking = await this.prisma.sessionBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.studentId !== studentId) {
      throw new BadRequestException('You can only cancel your own bookings');
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    return await this.prisma.sessionBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  }
}
