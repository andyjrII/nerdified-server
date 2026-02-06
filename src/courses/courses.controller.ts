import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Get,
  Post,
  BadRequestException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Course, CourseEnrollment } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Public } from '../common/decorators/public.decorator';
import { AtGuard } from '../common/guards/at.guard';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CourseEnrollmentSearchDto } from './dto/enrollment-search.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  /*
   * Returns featured (top-rated) courses for the home page.
   * Courses must have at least one review; sorted by average rating descending.
   */
  @Public()
  @Get('featured')
  @HttpCode(HttpStatus.OK)
  async getFeaturedCourses(): Promise<any[]> {
    return await this.coursesService.getFeaturedCourses(6, 1);
  }

  /*
   * Returns all Courses using pagination, search & level as filters
   */
  @Public()
  @Get(':page')
  @HttpCode(HttpStatus.OK)
  async getCourses(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
  ): Promise<Object> {
    return await this.coursesService.getCourses(page, search);
  }

  /*
   * Returns a single Course by id (public: only published)
   */
  @Public()
  @Get('course/:id')
  @HttpCode(HttpStatus.OK)
  async getCourseById(@Param('id', ParseIntPipe) id: number): Promise<Course> {
    return await this.coursesService.getCourseById(id);
  }

  /*
   * Tutor: get own course by id (any status, for edit/draft view)
   */
  @UseGuards(AtGuard)
  @Get('course/:id/tutor')
  @HttpCode(HttpStatus.OK)
  async getCourseByIdForTutor(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUserId() tutorId: number,
  ): Promise<Course> {
    return await this.coursesService.getCourseByIdForTutor(id, tutorId);
  }

  /*
   * Tutor: publish course (must have at least one session)
   */
  @UseGuards(AtGuard)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publishCourse(
    @Param('id', ParseIntPipe) id: number,
    @GetCurrentUserId() tutorId: number,
  ): Promise<Course> {
    return await this.coursesService.publishCourse(id, tutorId);
  }

  /*
   * Returns the outline of a Course by id
   */
  @Public()
  @Get('details/:id')
  @HttpCode(HttpStatus.OK)
  async getCourseDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<string> {
    return await this.coursesService.getDetails(id);
  }

  /*
   * Return 4 latest Courses
   */
  @Public()
  @Get('/latest/4')
  @HttpCode(HttpStatus.OK)
  async getLatestPosts(): Promise<Course[]> {
    return await this.coursesService.getLatestCourses();
  }

  @Public()
  @Get('top-enrolled/4')
  async getTopEnrolledCourses(): Promise<Course[]> {
    return this.coursesService.getTopEnrolledCourses();
  }

  // Admin endpoints

  /*
   * Creates a new Course (for Tutors - requires tutorId in body or from auth)
   * Note: This endpoint should be moved to a tutor-specific route in production
   */
  @UseGuards(AtGuard)
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createCourse(
    @Body() dto: CreateCourseDto & { tutorId?: number },
    @GetCurrentUserId() userId: number,
  ): Promise<Course | undefined> {
    // Use tutorId from body if provided, otherwise from auth (assuming it's a tutor)
    const tutorId = dto.tutorId || userId;
    return await this.coursesService.createCourse(dto, tutorId);
  }

  /*
   * Returns id and title of all Courses
   */
  @UseGuards(AtGuard)
  @Get('all/titles')
  async getCourseTitlesAndIds() {
    return await this.coursesService.getCourseTitlesAndIds();
  }

  /*
   * Updates an existing Course by id
   */
  @UseGuards(AtGuard)
  @Patch('update/:id')
  @HttpCode(HttpStatus.OK)
  async updateCourse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseDto,
  ): Promise<Course | undefined> {
    return await this.coursesService.updateCourse(id, dto);
  }

  /*
   * Deletes a Course
   */
  @UseGuards(AtGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteCourse(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Course | undefined> {
    return await this.coursesService.deleteCourse(id);
  }

  /*
   * Returns all the payments for Courses
   */
  @UseGuards(AtGuard)
  @Get('payments/:page')
  @HttpCode(HttpStatus.OK)
  async coursePayments(
    @Param('page', ParseIntPipe) page: number,
    @Query() dto: CourseEnrollmentSearchDto,
  ): Promise<Object> {
    return await this.coursesService.coursePayments(page, dto);
  }

  /*
   * Updates the enrollment status for a course & returns all the payments for Courses
   */
  @UseGuards(AtGuard)
  @Patch('update_status/:page')
  @HttpCode(HttpStatus.OK)
  async courseStatusUpdate(
    @Param('page', ParseIntPipe) page: number,
    @Body() dto: UpdateStatusDto,
  ): Promise<CourseEnrollment[] | undefined> {
    return await this.coursesService.courseStatusUpdate(page, dto);
  }
}
