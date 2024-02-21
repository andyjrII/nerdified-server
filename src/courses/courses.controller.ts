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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Course, CourseEnrollment, LEVEL } from '@prisma/client';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Public } from '../common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  removeDocument,
  saveDocumentToStorage,
} from '../common/helpers/document.storage';
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
    @Query('level') level: LEVEL,
  ): Promise<Object> {
    return await this.coursesService.getCourses(page, search, level);
  }

  /*
   * Returns the latest 5 courses from the database
   */
  @UseGuards(AtGuard)
  @Get('latest_courses/4')
  @HttpCode(HttpStatus.OK)
  async latestCourses(): Promise<Course[] | undefined> {
    return await this.coursesService.latestCourses();
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
  @Get('get-outline/:id')
  @HttpCode(HttpStatus.OK)
  async getOutline(
    @Param('id', ParseIntPipe) id: number,
    @Res() res,
  ): Promise<string> {
    const outlinePath = await this.coursesService.getOutline(id);
    if (outlinePath) {
      return res.sendFile(outlinePath, { root: './documents' });
    }
  }

  // Admin endpoints

  /*
   * Creates a new Courses
   */
  @UseGuards(AtGuard)
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createCourse(
    @Body() dto: CreateCourseDto,
  ): Promise<Course | undefined> {
    return await this.coursesService.createCourse(dto);
  }

  /*
   * Returns id and title of all Courses
   */
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
   * Deletes a Course & its outline by id
   */
  @UseGuards(AtGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteCourse(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Course | undefined> {
    const documentPath = await this.coursesService.getOutline(id);
    if (documentPath) {
      const documentFolderPath = join(process.cwd(), 'documents');
      const fullDocumentPath = join(documentFolderPath + '/' + documentPath);
      removeDocument(fullDocumentPath);
    }
    return await this.coursesService.deleteCourse(id);
  }

  /*
   * Adds outline to a Course & deletes the previous outline from the file system by id
   */
  @UseGuards(AtGuard)
  @Patch('upload/:id')
  @UseInterceptors(FileInterceptor('file', saveDocumentToStorage))
  @HttpCode(HttpStatus.OK)
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const documentName = file?.filename;
    if (!documentName) throw new BadRequestException('Invalid image format!');
    const prevDocument = await this.coursesService.getOutline(id);
    if (prevDocument) {
      const documentFolderPath = join(process.cwd(), 'images');
      const fullDocumentPath = join(documentFolderPath + '/' + prevDocument);
      removeDocument(fullDocumentPath);
    }
    return await this.coursesService.uploadDocument(id, documentName);
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
