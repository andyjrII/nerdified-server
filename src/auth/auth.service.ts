import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { Tokens } from './types/tokens.type';
import { JwtService } from '@nestjs/jwt/dist';
import { SigninDto } from './dto/signin.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Student } from '@prisma/client';
import { StudentsService } from '../students/students.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private studentsService: StudentsService,
  ) {}

  async signup(dto: SignupDto, image: Express.Multer.File): Promise<Tokens> {
    // check if student with the email already exists
    const student = await this.prisma.student.findUnique({
      where: { email: dto.email },
    });
    if (student) throw new BadRequestException('Student already exists!');

    // Upload the image to Cloudinary
    const uploadedImage = await this.studentsService.uploadImageToCloudinary(
      image,
    );
    if (!uploadedImage || !uploadedImage.secure_url) {
      throw new BadRequestException('Image upload failed');
    }

    // Store user details in the database
    const password = await this.hashData(dto.password);
    const newStudent = await this.prisma.student.create({
      data: {
        email: dto.email,
        password,
        phoneNumber: dto.phoneNumber,
        name: dto.name,
        address: dto.address,
        imagePath: uploadedImage.secure_url,
      },
    });
    const tokens = await this.getTokens(newStudent.id, newStudent.email);
    await this.updateRT(newStudent.id, tokens.refresh_token);
    return tokens;
  }

  async signin(dto: SigninDto): Promise<Tokens> {
    const student = await this.prisma.student.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!student) throw new UnauthorizedException('Access Denied!');
    const passwordMatches = await bcrypt.compare(
      dto.password,
      student.password,
    );
    if (!passwordMatches) throw new UnauthorizedException('Access Denied!');
    const tokens = await this.getTokens(student.id, student.email);
    await this.updateRT(student.id, tokens.refresh_token);
    return tokens;
  }

  async signout(email: string) {
    return await this.prisma.student.updateMany({
      where: {
        email,
        refreshToken: {
          not: null,
        },
      },
      data: {
        refreshToken: null,
      },
    });
  }

  async refresh(id: number, refreshToken: string): Promise<Tokens> {
    const student = await this.prisma.student.findUnique({
      where: { id },
    });
    if (!student || !student.refreshToken)
      throw new UnauthorizedException('Access Denied!');
    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      student.refreshToken,
    );
    if (!refreshTokenMatches) throw new UnauthorizedException('Access Denied!');
    const tokens = await this.getTokens(student.id, student.email);
    await this.updateRT(student.id, tokens.refresh_token);
    return tokens;
  }

  async changePassword(dto: UpdatePasswordDto): Promise<Student | undefined> {
    const student = await this.prisma.student.findUnique({
      where: {
        id: dto.studentId,
      },
    });
    if (!student) throw new UnauthorizedException('Access Denied!');

    const passwordMatches = await bcrypt.compare(
      dto.oldPassword,
      student.password,
    );
    if (!passwordMatches) throw new UnauthorizedException('Access Denied!');
    const password = await this.hashData(dto.newPassword);

    const updatedStudent = await this.prisma.student.update({
      where: { id: dto.studentId },
      data: {
        password,
      },
    });
    return updatedStudent;
  }

  // helper & utility functions

  async updateRT(userId: number, rt: string) {
    const refreshToken = await this.hashData(rt);
    await this.prisma.student.update({
      where: {
        id: userId,
      },
      data: {
        refreshToken,
      },
    });
  }

  hashData(data: string) {
    return bcrypt.hash(data, 10);
  }

  async getTokens(userId: number, email: string): Promise<Tokens> {
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: process.env.AT_SECRET_KEY,
          expiresIn: '1h',
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
        },
        {
          secret: process.env.RT_SECRET_KEY,
          expiresIn: '7d',
        },
      ),
    ]);
    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  // Admin Functions

  async adminSignin(dto: SigninDto): Promise<[Tokens, string]> {
    const admin = await this.prisma.admin.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!admin) throw new UnauthorizedException('Access Denied!');
    const passwordMatches = await bcrypt.compare(dto.password, admin.password);
    if (!passwordMatches) throw new UnauthorizedException('Access Denied!');
    const tokens = await this.getTokens(admin.id, admin.email);
    await this.adminUpdateRT(admin.id, tokens.refresh_token);
    return [tokens, admin.role];
  }

  async adminSignout(email: string) {
    return await this.prisma.admin.updateMany({
      where: {
        email,
        refreshToken: {
          not: null,
        },
      },
      data: {
        refreshToken: null,
      },
    });
  }

  async adminRefresh(id: number, refreshToken: string): Promise<Tokens> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
    });
    if (!admin || !admin.refreshToken)
      throw new UnauthorizedException('Access Denied!');
    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      admin.refreshToken,
    );
    if (!refreshTokenMatches) throw new UnauthorizedException('Access Denied!');
    const tokens = await this.getTokens(admin.id, admin.email);
    await this.adminUpdateRT(admin.id, tokens.refresh_token);
    return tokens;
  }

  async adminUpdateRT(userId: number, rt: string) {
    const refreshToken = await this.hashData(rt);
    await this.prisma.admin.update({
      where: {
        id: userId,
      },
      data: {
        refreshToken,
      },
    });
  }
}
