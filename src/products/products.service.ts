import { ConflictException, Injectable } from '@nestjs/common';
import { PLATFORM, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts(
    page: number,
    search: string,
    platform: PLATFORM,
  ): Promise<Object> {
    if (!platform) platform = undefined;
    const [products, totalProducts] = await Promise.all([
      await this.prisma.product.findMany({
        where: {
          OR: [
            {
              title: { contains: search, mode: 'insensitive' },
            },
          ],
          platform:
            platform !== 'WEB' || 'DESKTOP' || 'MOBILE' ? platform : undefined,
        },
        skip: 20 * (page - 1),
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      await this.prisma.product.count({}),
    ]);
    return { products, totalProducts };
  }

  async findProduct(id: number): Promise<Product> {
    return await this.prisma.product.findUnique({
      where: { id },
    });
  }

  async getImages(
    page: number,
    search: string,
    platform: PLATFORM,
  ): Promise<String[]> {
    if (!platform) platform = undefined;
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          {
            title: { contains: search, mode: 'insensitive' },
          },
        ],
        platform:
          platform !== 'WEB' || 'DESKTOP' || 'MOBILE' ? platform : undefined,
      },
      skip: 20 * (page - 1),
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    });
    let imagePath = [];
    for (let index = 0; index < products.length; index++) {
      imagePath.push(products[index].imagePath);
    }
    return imagePath;
  }

  async getImageByUrl(imageurl: string): Promise<string> {
    const product = await this.prisma.product.findFirst({
      where: { imagePath: imageurl },
    });
    return product.imagePath;
  }

  async getImageById(id: number): Promise<string> {
    const product = await this.prisma.product.findUnique({
      where: {
        id,
      },
    });
    return product.imagePath;
  }

  // Admin Service

  async createProduct(dto: CreateProductDto): Promise<Product | undefined> {
    const productExists = await this.prisma.product.findFirst({
      where: { title: dto.title, platform: dto.platform },
    });

    if (productExists) throw new ConflictException('Product already exists!');

    const product = await this.prisma.product.create({
      data: {
        title: dto.title,
        platform: dto.platform,
        url: dto.url,
        description: dto.description,
      },
    });
    if (product) return product;
    return undefined;
  }

  async updateProduct(
    id: number,
    dto: UpdateProductDto,
  ): Promise<Product | undefined> {
    const productExist = await this.prisma.product.findUnique({
      where: { id, url: dto.url },
    });
    if (productExist) dto.url = undefined;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        title: dto.title || undefined,
        description: dto.description || undefined,
        url: dto.url || undefined,
        platform: dto.platform || undefined,
      },
    });

    if (product) return product;
    return undefined;
  }

  async uploadImage(
    id: number,
    imagePath: string,
  ): Promise<Product | undefined> {
    const product = await this.prisma.product.update({
      where: { id },
      data: { imagePath },
    });
    return product;
  }

  async deleteProduct(id: number): Promise<Product | undefined> {
    return await this.prisma.product.delete({
      where: { id },
    });
  }
}
