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
import { Public } from '../common/decorators/public.decorator';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /*
   * Returns a Student by email
   */
  @UseGuards(AtGuard)
  @Get(':email')
  @HttpCode(HttpStatus.OK)
  async getStudentByEmail(@Param('email') email: string): Promise<Student> {
    return await this.studentsService.getStudent(email);
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
   * Returns the total number of Courses Enrolled by a Student using email
   */
  @UseGuards(AtGuard)
  @Get('total/:email')
  @HttpCode(HttpStatus.OK)
  async totalEnrolled(@Param('email') email: string): Promise<Number> {
    return await this.studentsService.totalEnrolled(email);
  }

  /*
   * Returns the total costs of Courses Enrolled by a Student using email
   */
  @UseGuards(AtGuard)
  @Get('total-paid/:email')
  @HttpCode(HttpStatus.OK)
  async getTotalPaidByStudentEmail(
    @Param('email') email: string,
  ): Promise<string> {
    return await this.studentsService.totalPaidByStudentEmail(email);
  }

  /*
   * Update/upload a Student image by id
   */
  @UseGuards(AtGuard)
  @Patch('upload/:email')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.OK)
  async uploadImage(
    @UploadedFile() image: Express.Multer.File,
    @Param('email') email: string,
  ): Promise<string> {
    if (!image) {
      throw new BadRequestException('Image is required');
    }
    const id = await this.studentsService.getIdByEmail(email);
    const imagePath = await this.studentsService.uploadImage(id, image);
    return imagePath;
  }

  /*
   * Returns a Student image by email
   */
  @Public()
  @Get('image/:email')
  @HttpCode(HttpStatus.OK)
  async getImage(@Param('email') email: string, @Res() res): Promise<string> {
    const imagePath = await this.studentsService.getImage(email);
    if (imagePath) {
      return res.sendFile(imagePath, { root: './images' });
    }
  }

  /*
   * Returns an array of Student imagepaths by an array of emails
   */
  @Public()
  @Post('imagepaths')
  @HttpCode(HttpStatus.OK)
  async getImagePaths(@Body() emails: string[]): Promise<string[]> {
    return await this.studentsService.getImages(emails);
  }

  /*
   * Return the image for a particular Student by imageurl
   */
  @Public()
  @Get('student/image/:imageurl')
  @HttpCode(HttpStatus.OK)
  async getImageByPath(
    @Param('imageurl') imageurl: string,
    @Res() res,
  ): Promise<string> {
    const imagePath = await this.studentsService.getImageByPath(imageurl);
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
