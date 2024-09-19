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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Course, CourseEnrollment } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Public } from '../common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { removeDocument } from '../common/helpers/document.storage';
import { join } from 'path';
import { AtGuard } from '../common/guards/at.guard';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CourseEnrollmentSearchDto } from './dto/enrollment-search.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

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
   * Returns a single Course by id
   */
  @Public()
  @Get('course/:id')
  @HttpCode(HttpStatus.OK)
  async getCourseById(@Param('id', ParseIntPipe) id: number): Promise<Course> {
    return await this.coursesService.getCourseById(id);
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
   * Creates a new Courses
   */
  @UseGuards(AtGuard)
  @Post('create')
  @UseInterceptors(FileInterceptor('pdf'))
  @HttpCode(HttpStatus.CREATED)
  async createCourse(
    @Body() dto: CreateCourseDto,
    @UploadedFile() pdf: Express.Multer.File,
  ): Promise<Course | undefined> {
    if (!pdf) throw new BadRequestException('PDF is required');
    return await this.coursesService.createCourse(dto, pdf);
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
  @UseInterceptors(FileInterceptor('pdf'))
  @HttpCode(HttpStatus.OK)
  async updateCourse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseDto,
    @UploadedFile() pdf: Express.Multer.File,
  ): Promise<Course | undefined> {
    if (!pdf) pdf = undefined;
    return await this.coursesService.updateCourse(id, dto, pdf);
  }

  /*
   * Deletes a Course & its outline by id
   */
  @UseGuards(AtGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteCourse(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Course | undefined> {
    const documentPath = await this.coursesService.getDetails(id);
    if (documentPath) {
      const documentFolderPath = join(process.cwd(), 'documents');
      const fullDocumentPath = join(documentFolderPath + '/' + documentPath);
      removeDocument(fullDocumentPath);
    }
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
