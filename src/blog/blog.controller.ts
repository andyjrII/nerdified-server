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
import { BlogService } from './blog.service';
import { Blog } from '@prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Public } from '../common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  removeImage,
  saveImageToStorage,
} from '../common/helpers/image.storage';
import { join } from 'path';
import { AtGuard } from '../common/guards/at.guard';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  /*
   * Returns all Blog Posts using pagination, search, startDate & endDate
   */
  @Public()
  @Get(':page')
  @HttpCode(HttpStatus.OK)
  async getPosts(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<Object> {
    return await this.blogService.getPosts(page, search, startDate, endDate);
  }

  /*
   * Returns all Blog images using pagination, search, endDate & startDate as filters
   */
  @Public()
  @Get('images/:page')
  @HttpCode(HttpStatus.OK)
  async getImages(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<String[]> {
    return await this.blogService.getImages(page, search, startDate, endDate);
  }

  /*
   * Return a Post by id
   */
  @Public()
  @Get('post/:id')
  @HttpCode(HttpStatus.OK)
  async getPost(@Param('id', ParseIntPipe) id: number): Promise<Blog> {
    return await this.blogService.getPost(id);
  }

  /*
   * Return the image for a particular Post by imagePath
   */
  @Public()
  @Get('image/:imageurl')
  @HttpCode(HttpStatus.OK)
  async getImageByPath(
    @Param('imageurl') imageurl: string,
    @Res() res,
  ): Promise<string> {
    const imagePath = await this.blogService.getImageByPath(imageurl);
    if (imagePath) {
      return res.sendFile(imagePath, { root: './images' });
    }
  }

  // Admin Endpoints

  /*
   * Creates a Blog Post
   */
  @UseGuards(AtGuard)
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createPost(@Body() dto: CreatePostDto): Promise<Blog | undefined> {
    return await this.blogService.createPost(dto);
  }

  /*
   * Updates/edit an existing Post by id
   */
  @UseGuards(AtGuard)
  @Patch('update/:id')
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<Blog | undefined> {
    return await this.blogService.updatePost(id, dto);
  }

  /*
   * Deletes an existing Post & its image from system file by id
   */
  @UseGuards(AtGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteBlog(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Blog | undefined> {
    const imagePath = await this.blogService.getImageById(id);
    const imagesFolderPath = join(process.cwd(), 'images');
    const fullImagePath = join(imagesFolderPath + '/' + imagePath);
    removeImage(fullImagePath);
    return await this.blogService.deletePost(id);
  }

  /*
   * Uploads/update an existing Post image by id
   */
  @UseGuards(AtGuard)
  @Patch('upload/:id')
  @UseInterceptors(FileInterceptor('image', saveImageToStorage))
  @HttpCode(HttpStatus.OK)
  async uploadImage(
    @UploadedFile() image: Express.Multer.File,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const imageName = image?.filename;
    if (!imageName) throw new BadRequestException('Invalid image format!');
    const prevImage = await this.blogService.getImageById(id);
    if (prevImage) {
      const imagesFolderPath = join(process.cwd(), 'images');
      const fullImagePath = join(imagesFolderPath + '/' + prevImage);
      removeImage(fullImagePath);
    }
    return await this.blogService.uploadImage(id, imageName);
  }
}
