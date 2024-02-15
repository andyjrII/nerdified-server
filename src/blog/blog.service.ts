import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Blog } from '@prisma/client';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async getPosts(
    page: number,
    search: string,
    startDate: string,
    endDate: string,
  ): Promise<Object> {
    const [posts, totalPosts] = await Promise.all([
      await this.prisma.blog.findMany({
        where: {
          OR: [
            {
              title: { contains: search, mode: 'insensitive' },
            },
            {
              description: { contains: search, mode: 'insensitive' },
            },
          ],
          datePosted: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined,
          },
        },
        skip: 20 * (page - 1),
        take: 20,
        orderBy: {
          datePosted: 'desc',
        },
      }),
      this.prisma.blog.count({}),
    ]);
    return { posts, totalPosts };
  }

  async getPost(id: number): Promise<Blog> {
    return await this.prisma.blog.findUnique({
      where: { id },
    });
  }

  async getImages(
    page: number,
    search: string,
    startDate: string,
    endDate: string,
  ): Promise<String[]> {
    const posts = await this.prisma.blog.findMany({
      where: {
        OR: [
          {
            title: { contains: search, mode: 'insensitive' },
          },
          {
            description: { contains: search, mode: 'insensitive' },
          },
        ],
        datePosted: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
      },
      skip: 20 * (page - 1),
      take: 20,
      orderBy: {
        datePosted: 'desc',
      },
    });
    let imagePath = [];
    for (let index = 0; index < posts.length; index++) {
      imagePath.push(posts[index].imagePath);
    }
    return imagePath;
  }

  async getImageByPath(imageUrl: string): Promise<string> {
    const blog = await this.prisma.blog.findFirst({
      where: { imagePath: imageUrl },
    });
    return blog.imagePath;
  }

  async getImageById(id: number): Promise<string> {
    const blog = await this.prisma.blog.findUnique({
      where: {
        id,
      },
    });
    return blog.imagePath;
  }

  async uploadImage(id: number, imagePath: string): Promise<Blog | undefined> {
    const blog = await this.prisma.blog.update({
      where: { id },
      data: { imagePath },
    });
    return blog;
  }

  async createPost(dto: CreatePostDto): Promise<Blog | undefined> {
    const postExist = await this.prisma.blog.findUnique({
      where: { postUrl: dto.postUrl },
    });
    if (postExist)
      throw new BadRequestException('Post with url already exists!');

    const post = await this.prisma.blog.create({
      data: {
        title: dto.title,
        postUrl: dto.postUrl,
        datePosted: new Date(dto.datePosted),
        description: dto.description,
      },
    });
    if (post) return post;
    return undefined;
  }

  async updatePost(id: number, dto: UpdatePostDto): Promise<Blog | undefined> {
    const postExist = await this.prisma.blog.findUnique({
      where: { id, postUrl: dto.postUrl },
    });
    if (postExist) var postUrl = undefined;

    const post = await this.prisma.blog.update({
      where: { id },
      data: {
        title: dto.title || undefined,
        postUrl,
        description: dto.description || undefined,
        datePosted: dto.datePosted || undefined,
      },
    });
    if (post) return post;
    return undefined;
  }

  async deletePost(id: number): Promise<Blog | undefined> {
    return await this.prisma.blog.delete({
      where: { id },
    });
  }
}
