import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { AtGuard } from '../common/guards/at.guard';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { BookSessionDto } from './dto/book-session.dto';
import {
  Session,
  TutorAvailability,
  SessionBooking,
} from '@prisma/client';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /*
   * Create tutor availability (Tutor only)
   */
  @UseGuards(AtGuard)
  @Post('availability')
  @HttpCode(HttpStatus.CREATED)
  async createAvailability(
    @Body() dto: CreateAvailabilityDto,
    @GetCurrentUserId() tutorId: number,
  ): Promise<TutorAvailability> {
    return await this.sessionsService.createAvailability(
      tutorId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
    );
  }

  /*
   * Get tutor availability
   */
  @UseGuards(AtGuard)
  @Get('availability')
  @HttpCode(HttpStatus.OK)
  async getTutorAvailability(
    @GetCurrentUserId() tutorId: number,
  ): Promise<TutorAvailability[]> {
    return await this.sessionsService.getTutorAvailability(tutorId);
  }

  /*
   * Create a session (Tutor only)
   */
  @UseGuards(AtGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body() dto: CreateSessionDto,
    @GetCurrentUserId() tutorId: number,
  ): Promise<Session> {
    return await this.sessionsService.createSession(
      dto.courseId,
      tutorId,
      new Date(dto.startTime),
      new Date(dto.endTime),
      dto.title,
      dto.description,
    );
  }

  /*
   * Get sessions by course (Public or authenticated)
   */
  @Get('course/:courseId')
  @HttpCode(HttpStatus.OK)
  async getSessionsByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<Session[]> {
    return await this.sessionsService.getSessionsByCourse(courseId);
  }

  /*
   * Get sessions by tutor (Tutor only - from JWT)
   */
  @UseGuards(AtGuard)
  @Get('tutor')
  @HttpCode(HttpStatus.OK)
  async getSessionsByTutor(
    @GetCurrentUserId() tutorId: number,
  ): Promise<Session[]> {
    return await this.sessionsService.getSessionsByTutor(tutorId);
  }

  /*
   * Get suggested time slots for creating a session (Tutor only)
   * Query: courseId, from (ISO date), to (ISO date), durationMinutes (optional, default 60)
   */
  @UseGuards(AtGuard)
  @Get('suggested-slots')
  @HttpCode(HttpStatus.OK)
  async getSuggestedSlots(
    @GetCurrentUserId() tutorId: number,
    @Query('courseId', ParseIntPipe) courseId: number,
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
    @Query('durationMinutes') durationMinutes?: string,
  ) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
      return [];
    }
    const duration = durationMinutes ? parseInt(durationMinutes, 10) : 60;
    return await this.sessionsService.getSuggestedSlots(
      tutorId,
      courseId,
      from,
      to,
      isNaN(duration) ? 60 : duration,
    );
  }

  /*
   * Book a session (Student only)
   */
  @UseGuards(AtGuard)
  @Post(':sessionId/book')
  @HttpCode(HttpStatus.CREATED)
  async bookSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @GetCurrentUserId() studentId: number,
  ): Promise<SessionBooking> {
    return await this.sessionsService.bookSession(sessionId, studentId);
  }

  /*
   * Get student bookings (Student only)
   */
  @UseGuards(AtGuard)
  @Get('bookings')
  @HttpCode(HttpStatus.OK)
  async getStudentBookings(
    @GetCurrentUserId() studentId: number,
  ): Promise<SessionBooking[]> {
    return await this.sessionsService.getStudentBookings(studentId);
  }

  /*
   * Cancel a booking (Student only)
   */
  @UseGuards(AtGuard)
  @Delete('bookings/:bookingId')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @GetCurrentUserId() studentId: number,
  ): Promise<SessionBooking> {
    return await this.sessionsService.cancelBooking(bookingId, studentId);
  }

  /*
   * Cancel a session (Tutor only)
   */
  @UseGuards(AtGuard)
  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  async cancelSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @GetCurrentUserId() tutorId: number,
  ): Promise<Session> {
    return await this.sessionsService.cancelSession(sessionId, tutorId);
  }

  /*
   * Delete tutor availability (Tutor only)
   */
  @UseGuards(AtGuard)
  @Delete('availability/:availabilityId')
  @HttpCode(HttpStatus.OK)
  async deleteAvailability(
    @Param('availabilityId', ParseIntPipe) availabilityId: number,
    @GetCurrentUserId() tutorId: number,
  ): Promise<TutorAvailability> {
    return await this.sessionsService.deleteAvailability(
      availabilityId,
      tutorId,
    );
  }
}
