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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { PLATFORM, Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { Public } from '../common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  removeImage,
  saveImageToStorage,
} from '../common/helpers/image.storage';
import { UpdateProductDto } from './dto/update-product.dto';
import { join } from 'path';
import { AtGuard } from '../common/guards/at.guard';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /*
   * Returns all Products using pagination, search & platform as filters
   */
  @Public()
  @Get(':page')
  @HttpCode(HttpStatus.OK)
  async getProducts(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
    @Query('platform') platform: PLATFORM,
  ): Promise<Object> {
    return await this.productsService.getProducts(page, search, platform);
  }

  /*
   * Returns images for all Products using pagination, search & platform as filters
   */
  @Public()
  @Get('images/:page')
  @HttpCode(HttpStatus.OK)
  async getImages(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
    @Query('platform') platform: PLATFORM,
  ): Promise<String[]> {
    return await this.productsService.getImages(page, search, platform);
  }

  /*
   * Returns a Product by id
   */
  @Public()
  @Get('find/:id')
  @HttpCode(HttpStatus.OK)
  async findProduct(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    return await this.productsService.findProduct(id);
  }

  /*
   * Returns the image for a Product by image path
   */
  @Public()
  @Get('image/:imageurl')
  @HttpCode(HttpStatus.OK)
  async getImageByUrl(
    @Param('imageurl') imageurl: string,
    @Res() res,
  ): Promise<string> {
    const imagePath = await this.productsService.getImageByUrl(imageurl);
    if (imagePath) {
      return res.sendFile(imagePath, { root: './images' });
    }
  }

  // Admin Endpoints

  /*
   * Creates a Product
   */
  @UseGuards(AtGuard)
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createProduct(
    @Body() dto: CreateProductDto,
  ): Promise<Product | undefined> {
    return await this.productsService.createProduct(dto);
  }

  /*
   * Upload/edit the image for a Product by id
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
    const prevImage = await this.productsService.getImageById(id);
    if (prevImage) {
      const imagesFolderPath = join(process.cwd(), 'images');
      const fullImagePath = join(imagesFolderPath + '/' + prevImage);
      removeImage(fullImagePath);
    }
    return await this.productsService.uploadImage(id, imageName);
  }

  /*
   * Update/edit a Product by id
   */
  @UseGuards(AtGuard)
  @Patch('update/:id')
  @HttpCode(HttpStatus.OK)
  async updateCourse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ): Promise<Product | undefined> {
    return await this.productsService.updateProduct(id, dto);
  }

  /*
   * Deletes a Product & its image by id
   */
  @UseGuards(AtGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteProduct(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Product | undefined> {
    const imagePath = await this.productsService.getImageById(id);
    const imagesFolderPath = join(process.cwd(), 'images');
    const fullImagePath = join(imagesFolderPath + '/' + imagePath);
    removeImage(fullImagePath);
    return await this.productsService.deleteProduct(id);
  }
}
