import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session, TutorAvailability, SessionBooking } from '@prisma/client';
import { DAYOFWEEK } from '@prisma/client';
import { LivekitService } from '../livekit/livekit.service';

const DAY_SHORT_TO_ENUM: Record<string, DAYOFWEEK> = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY',
};

/** Get day of week and HH:mm in a timezone from a Date (for availability checks) */
function getLocalDayAndTime(
  date: Date,
  timezone: string = 'UTC',
): { dayOfWeek: DAYOFWEEK; timeHHmm: string } {
  const dayShort = new Date(date).toLocaleString('en-GB', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayOfWeek = DAY_SHORT_TO_ENUM[dayShort] ?? 'MONDAY';
  const timeHHmm = new Date(date).toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return { dayOfWeek, timeHHmm };
}

/** Compare "HH:mm" strings (e.g. "09:00" <= "10:30") */
function timeLessOrEqual(a: string, b: string): boolean {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah < bh || (ah === bh && am <= bm);
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
  ) {}

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

    if (course.status !== 'DRAFT') {
      throw new BadRequestException(
        'Sessions can only be added to a draft course. Once published, use "Add session request" for extra sessions.',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    if (startTime < new Date()) {
      throw new BadRequestException('Cannot schedule a session in the past');
    }

    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { availability: true },
    });
    const timezone = tutor?.timezone ?? 'UTC';

    // Conflict prevention: no overlap with existing non-cancelled sessions
    const overlapping = await this.prisma.session.findFirst({
      where: {
        tutorId,
        status: { not: 'CANCELLED' },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    if (overlapping) {
      throw new ConflictException(
        'This time slot overlaps with an existing session. Please choose a different time.',
      );
    }

    // If tutor has availability set, session must fall within one of the windows (in tutor's timezone)
    const availabilities = await this.prisma.tutorAvailability.findMany({
      where: { tutorId, isAvailable: true },
    });
    if (availabilities.length > 0) {
      const startLocal = getLocalDayAndTime(startTime, timezone);
      const endLocal = getLocalDayAndTime(endTime, timezone);
      const dayMatch = availabilities.filter(
        (a) => a.dayOfWeek === startLocal.dayOfWeek,
      );
      if (dayMatch.length === 0) {
        throw new BadRequestException(
          `You have no availability set for ${startLocal.dayOfWeek}. Please set availability for that day or choose another date.`,
        );
      }
      const withinSome = dayMatch.some(
        (a) =>
          timeLessOrEqual(a.startTime, startLocal.timeHHmm) &&
          timeLessOrEqual(endLocal.timeHHmm, a.endTime),
      );
      if (!withinSome) {
        throw new BadRequestException(
          'Session time must fall within your set availability window for that day.',
        );
      }
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

  /**
   * Create a booking for every (enrolled student, session) when enrollment is STARTED.
   * Called when enrollment status becomes STARTED or when a new session is added (add-session approval).
   */
  async createBookingsForEnrolledStudents(courseId: number): Promise<void> {
    const [enrollments, sessions] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where: { courseId, status: 'STARTED' },
        select: { studentId: true },
      }),
      this.prisma.session.findMany({
        where: { courseId, status: { not: 'CANCELLED' } },
        select: { id: true },
      }),
    ]);
    if (enrollments.length === 0 || sessions.length === 0) return;

    const data: { sessionId: number; studentId: number }[] = [];
    for (const e of enrollments) {
      for (const s of sessions) {
        data.push({ sessionId: s.id, studentId: e.studentId });
      }
    }
    await this.prisma.sessionBooking.createMany({
      data,
      skipDuplicates: true,
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

  /**
   * Get suggested time slots for creating a session: within tutor availability,
   * no conflicts with existing sessions, in the given date range.
   * Returns slots in 30-min steps; duration is in minutes.
   */
  async getSuggestedSlots(
    tutorId: number,
    courseId: number,
    from: Date,
    to: Date,
    durationMinutes: number = 60,
  ): Promise<Array<{ start: string; end: string }>> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tutorId },
    });
    if (!course) return [];

    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
      include: { availability: true },
    });
    const timezone = tutor?.timezone ?? 'UTC';
    const availabilities =
      tutor?.availability?.filter((a) => a.isAvailable) ?? [];
    if (availabilities.length === 0) return [];

    const existingSessions = await this.prisma.session.findMany({
      where: { tutorId, status: { not: 'CANCELLED' } },
      select: { startTime: true, endTime: true },
    });

    const slots: Array<{ start: string; end: string }> = [];
    const stepMs = 30 * 60 * 1000;
    const durationMs = durationMinutes * 60 * 1000;
    const now = new Date();

    for (
      let slotStart = new Date(from.getTime());
      slotStart.getTime() + durationMs <= to.getTime();
      slotStart = new Date(slotStart.getTime() + stepMs)
    ) {
      if (slotStart < now) continue;
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      const startLocal = getLocalDayAndTime(slotStart, timezone);
      const endLocal = getLocalDayAndTime(slotEnd, timezone);
      const dayAvail = availabilities.filter(
        (a) => a.dayOfWeek === startLocal.dayOfWeek,
      );
      const withinSome =
        dayAvail.length > 0 &&
        dayAvail.some(
          (a) =>
            timeLessOrEqual(a.startTime, startLocal.timeHHmm) &&
            timeLessOrEqual(endLocal.timeHHmm, a.endTime),
        );
      if (!withinSome) continue;
      const overlaps = existingSessions.some(
        (s) =>
          slotStart.getTime() < new Date(s.endTime).getTime() &&
          slotEnd.getTime() > new Date(s.startTime).getTime(),
      );
      if (!overlaps) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
      if (slots.length >= 50) break;
    }

    return slots;
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

  async cancelSession(
    sessionId: number,
    tutorId: number,
  ): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        bookings: true,
        course: { include: { enrollments: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.tutorId !== tutorId) {
      throw new BadRequestException(
        'You can only cancel sessions that belong to you',
      );
    }

    if (session.status === 'CANCELLED') {
      throw new BadRequestException('Session is already cancelled');
    }

    if (session.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed session');
    }

    const hasEnrolledStudents = session.course.enrollments.some(
      (e) => e.status === 'STARTED',
    );
    if (hasEnrolledStudents) {
      throw new BadRequestException(
        'Cannot cancel a session once students have enrolled. Use a Reschedule request for changes.',
      );
    }

    // Update all active bookings to cancelled
    if (session.bookings && session.bookings.length > 0) {
      await this.prisma.sessionBooking.updateMany({
        where: {
          sessionId,
          status: 'CONFIRMED',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });
    }

    return await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  // ---------- Reschedule requests ----------
  async createRescheduleRequest(
    tutorId: number,
    sessionId: number,
    requestedStartTime: Date,
    requestedEndTime: Date,
    reason: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { course: true },
    });
    if (!session || session.tutorId !== tutorId)
      throw new NotFoundException('Session not found');
    if (session.course.status !== 'PUBLISHED')
      throw new BadRequestException('Course must be published');
    const hasEnrolled = await this.prisma.courseEnrollment.findFirst({
      where: { courseId: session.courseId, status: 'STARTED' },
    });
    if (!hasEnrolled)
      throw new BadRequestException(
        'No students enrolled yet; edit the session directly.',
      );
    return this.prisma.rescheduleRequest.create({
      data: {
        sessionId,
        requestedStartTime,
        requestedEndTime,
        reason,
        requestedByTutorId: tutorId,
      },
    });
  }

  async getRescheduleRequestsForTutor(tutorId: number) {
    return this.prisma.rescheduleRequest.findMany({
      where: { session: { tutorId } },
      include: { session: { include: { course: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRescheduleRequestsPending() {
    return this.prisma.rescheduleRequest.findMany({
      where: { status: 'PENDING' },
      include: { session: { include: { course: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveRescheduleRequest(
    requestId: number,
    adminId: number,
    status: 'APPROVED' | 'REJECTED',
    adminNote?: string,
  ) {
    const req = await this.prisma.rescheduleRequest.findUnique({
      where: { id: requestId },
      include: { session: true },
    });
    if (!req || req.status !== 'PENDING')
      throw new NotFoundException('Request not found or already reviewed');
    await this.prisma.rescheduleRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        adminNote: adminNote ?? undefined,
      },
    });
    if (status === 'APPROVED') {
      await this.prisma.session.update({
        where: { id: req.sessionId },
        data: {
          startTime: req.requestedStartTime,
          endTime: req.requestedEndTime,
        },
      });
    }
    return this.prisma.rescheduleRequest.findUnique({
      where: { id: requestId },
      include: { session: { include: { course: true } } },
    });
  }

  // ---------- Add session requests ----------
  async createAddSessionRequest(
    tutorId: number,
    courseId: number,
    startTime: Date,
    endTime: Date,
    reason: string,
    title?: string,
    description?: string,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tutorId },
      include: { sessions: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== 'PUBLISHED')
      throw new BadRequestException('Course must be published');
    const hasEnrolled = await this.prisma.courseEnrollment.findFirst({
      where: { courseId, status: 'STARTED' },
    });
    if (!hasEnrolled)
      throw new BadRequestException(
        'No students enrolled; add sessions from the course draft flow.',
      );
    return this.prisma.addSessionRequest.create({
      data: {
        courseId,
        startTime,
        endTime,
        title,
        description,
        reason,
        requestedByTutorId: tutorId,
      },
    });
  }

  async getAddSessionRequestsForTutor(tutorId: number) {
    return this.prisma.addSessionRequest.findMany({
      where: { course: { tutorId } },
      include: { course: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAddSessionRequestsPending() {
    return this.prisma.addSessionRequest.findMany({
      where: { status: 'PENDING' },
      include: { course: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveAddSessionRequest(
    requestId: number,
    adminId: number,
    status: 'APPROVED' | 'REJECTED',
    adminNote?: string,
  ) {
    const req = await this.prisma.addSessionRequest.findUnique({
      where: { id: requestId },
      include: { course: true },
    });
    if (!req || req.status !== 'PENDING')
      throw new NotFoundException('Request not found or already reviewed');
    await this.prisma.addSessionRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
        adminNote: adminNote ?? undefined,
      },
    });
    if (status === 'APPROVED') {
      const session = await this.prisma.session.create({
        data: {
          courseId: req.courseId,
          tutorId: req.course.tutorId,
          startTime: req.startTime,
          endTime: req.endTime,
          title: req.title,
          description: req.description,
          status: 'SCHEDULED',
        },
      });
      await this.createBookingsForEnrolledStudents(req.courseId);
    }
    return this.prisma.addSessionRequest.findUnique({
      where: { id: requestId },
      include: { course: true },
    });
  }

  async deleteAvailability(
    availabilityId: number,
    tutorId: number,
  ): Promise<TutorAvailability> {
    const availability = await this.prisma.tutorAvailability.findUnique({
      where: { id: availabilityId },
    });

    if (!availability) {
      throw new NotFoundException('Availability not found');
    }

    if (availability.tutorId !== tutorId) {
      throw new BadRequestException(
        'You can only delete your own availability',
      );
    }

    return await this.prisma.tutorAvailability.delete({
      where: { id: availabilityId },
    });
  }

  async generateLivekitToken(sessionId: number, userId: number) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tutor: true,
        course: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const now = new Date();

    // Allow participants to join up to 30 minutes before start and until 30 minutes after end
    const earlyJoinMs = 30 * 60 * 1000;
    if (now.getTime() + earlyJoinMs < startTime.getTime()) {
      const minutesUntil = Math.ceil(
        (startTime.getTime() - now.getTime() - earlyJoinMs) / (60 * 1000),
      );
      throw new BadRequestException(
        `You can join this session closer to the start time (${minutesUntil} minutes remaining).`,
      );
    }

    if (now.getTime() - earlyJoinMs > endTime.getTime()) {
      throw new BadRequestException('This session has already ended.');
    }

    let participantRole: 'tutor' | 'student' = 'student';
    let participantName: string | undefined;

    if (session.tutorId === userId) {
      participantRole = 'tutor';
      participantName = session.tutor?.name || 'Tutor';
    } else {
      const booking = await this.prisma.sessionBooking.findUnique({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId: userId,
          },
        },
        include: {
          student: true,
        },
      });

      if (!booking || booking.status === 'CANCELLED') {
        throw new ForbiddenException(
          'You need an active booking to join this session',
        );
      }

      participantName = booking.student?.name || booking.student?.email;
    }

    const roomName = session.meetingUrl || `session-${session.id}`;
    if (!session.meetingUrl) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { meetingUrl: roomName },
      });
    }

    // Mark session as in progress when tutor joins
    if (
      participantRole === 'tutor' &&
      session.status === 'SCHEDULED' &&
      now >= startTime
    ) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    const token = await this.livekit.createParticipantToken({
      roomName,
      identity: `${participantRole}-${userId}`,
      name: participantName,
      metadata: {
        sessionId: session.id,
        role: participantRole,
      },
      isPublisher: participantRole === 'tutor',
      ttlSeconds: 60 * 60,
    });

    return {
      token,
      url: this.livekit.websocketUrl,
      roomName,
      participant: {
        role: participantRole,
        name: participantName,
      },
      session: {
        id: session.id,
        title: session.title ?? session.course?.title,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
      },
    };
  }
}
