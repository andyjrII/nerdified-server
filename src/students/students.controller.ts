import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CourseEnrollment, Student } from '@prisma/client';
import { CourseEnrollmentDto } from './dto/course-enrollment.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  removeImage,
  saveImageToStorage,
} from '../common/helpers/image.storage';
import { AtGuard } from '../common/guards/at.guard';
import { join } from 'path';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /*
   * Returns a Student by email
   */
  @UseGuards(AtGuard)
  @Get(':email')
  @HttpCode(HttpStatus.OK)
  async findStudent(@Param('email') email: string): Promise<Student> {
    return await this.studentsService.findStudent(email);
  }

  /*
   * Allows a Student enroll for a Course
   */
  @UseGuards(AtGuard)
  @Post('enroll')
  @HttpCode(HttpStatus.CREATED)
  async courseEnrollment(
    @Body() dto: CourseEnrollmentDto,
  ): Promise<CourseEnrollment> {
    return await this.studentsService.courseEnrollment(dto);
  }

  /*
   * Returns all the Courses Enrolled by a Student using email param
   */
  @UseGuards(AtGuard)
  @Get('enrolled/:email')
  @HttpCode(HttpStatus.OK)
  async coursesEnrolled(
    @Param('email') email: string,
  ): Promise<CourseEnrollment[]> {
    return await this.studentsService.coursesEnrolled(email);
  }

  /*
   * Checks if a Course has been Enrolled for by a Student using email param
   */
  @UseGuards(AtGuard)
  @Get('course_enrolled/:courseId')
  @HttpCode(HttpStatus.OK)
  async courseAlreadyEnrolled(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<CourseEnrollment> {
    return await this.studentsService.courseAlreadyEnrolled(courseId);
  }

  /*
   * Returns the total number & total costs of Courses Enrolled by a Student using email param
   */
  @UseGuards(AtGuard)
  @Get('total/:email')
  @HttpCode(HttpStatus.OK)
  async totalEnrolled(@Param('email') email: string): Promise<Number> {
    return await this.studentsService.totalEnrolled(email);
  }

  /*
   * Update/upload a Student image by id
   */
  @UseGuards(AtGuard)
  @Patch('upload/:email')
  @UseInterceptors(FileInterceptor('image', saveImageToStorage))
  @HttpCode(HttpStatus.OK)
  async uploadImage(
    @UploadedFile() image: Express.Multer.File,
    @Param('email') email: string,
  ) {
    const id = await this.studentsService.getIdByEmail(email);
    const imageName = image?.filename;
    if (!imageName) throw new BadRequestException('Invalid image format!');
    const prevImage = await this.studentsService.getImageById(id);
    if (prevImage) {
      const imagesFolderPath = join(process.cwd(), 'images');
      const fullImagePath = join(imagesFolderPath + '/' + prevImage);
      removeImage(fullImagePath);
    }
    return await this.studentsService.uploadImage(id, imageName);
  }

  /*
   * Returns a Student image by email
   */
  @UseGuards(AtGuard)
  @Get('image/:email')
  @HttpCode(HttpStatus.OK)
  async getImage(@Param('email') email: string, @Res() res): Promise<string> {
    const imagePath = await this.studentsService.getImage(email);
    if (imagePath) {
      return res.sendFile(imagePath, { root: './images' });
    }
  }

  // Admin Endpoints

  /*
   * Returns all Students using pagination, search & level as filters
   */
  @UseGuards(AtGuard)
  @Get('search/:page')
  @HttpCode(HttpStatus.OK)
  async getStudents(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
  ): Promise<Object> {
    return await this.studentsService.getStudents(page, search);
  }

  /*
   * Deletes a Student & his/her image using id
   */
  @UseGuards(AtGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteStudent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Student | undefined> {
    const imagePath = await this.studentsService.getImageById(id);
    if (imagePath) {
      const imagesFolderPath = join(process.cwd(), 'images');
      const fullImagePath = join(imagesFolderPath + '/' + imagePath);
      removeImage(fullImagePath);
    }
    return await this.studentsService.deleteStudent(id);
  }
}
