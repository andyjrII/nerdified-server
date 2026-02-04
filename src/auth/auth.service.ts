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
import { Student, Tutor, UserRole } from '@prisma/client';
import { StudentsService } from '../students/students.service';
import { TutorsService } from '../tutors/tutors.service';
import { TutorSignupDto } from './dto/tutor-signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private studentsService: StudentsService,
    private tutorsService: TutorsService,
  ) {}

  async signup(dto: SignupDto, image: Express.Multer.File): Promise<Tokens> {
    // check if student with the email already exists
    const student = await this.prisma.student.findUnique({
      where: { email: dto.email },
    });
    if (student) throw new BadRequestException('Student already exists!');

    // Upload the image to Cloudinary
    let uploadedImage;
    try {
      console.log('Starting Cloudinary upload for student signup...');
      uploadedImage = await this.studentsService.uploadImageToCloudinary(image);
      console.log('Cloudinary upload successful:', uploadedImage?.secure_url);
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      throw new BadRequestException(
        error.message || 'Image upload failed. Please check Cloudinary configuration.',
      );
    }

    if (!uploadedImage || !uploadedImage.secure_url) {
      throw new BadRequestException('Image upload failed - no URL returned');
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
    const tokens = await this.getTokens(
      newStudent.id,
      newStudent.email,
      'STUDENT',
    );
    await this.updateRT(newStudent.id, tokens.refresh_token, 'STUDENT');
    return tokens;
  }

  /** Unified platform sign-in (student or tutor). Body must include role. */
  async signin(
    dto: SigninDto,
  ): Promise<Tokens | (Tokens & { approved: boolean })> {
    const role = dto.role;
    if (!role || (role !== 'STUDENT' && role !== 'TUTOR')) {
      throw new BadRequestException('role must be STUDENT or TUTOR');
    }
    if (role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { email: dto.email },
      });
      if (!student) throw new UnauthorizedException('Access Denied!');
      const passwordMatches = await bcrypt.compare(
        dto.password,
        student.password,
      );
      if (!passwordMatches) throw new UnauthorizedException('Access Denied!');
      const tokens = await this.getTokens(student.id, student.email, 'STUDENT');
      await this.updateRT(student.id, tokens.refresh_token, 'STUDENT');
      return tokens;
    }
    const tutor = await this.prisma.tutor.findUnique({
      where: { email: dto.email },
    });
    if (!tutor) throw new UnauthorizedException('Access Denied!');
    const passwordMatches = await bcrypt.compare(dto.password, tutor.password);
    if (!passwordMatches) throw new UnauthorizedException('Access Denied!');
    const tokens = await this.getTokens(tutor.id, tutor.email, 'TUTOR');
    await this.updateRT(tutor.id, tokens.refresh_token, 'TUTOR');
    return { ...tokens, approved: tutor.approved };
  }

  /** Unified sign-out: clear refresh token in the correct table by role. */
  async signout(userId: number, role: UserRole) {
    const r = String(role).toUpperCase();
    switch (r) {
      case 'STUDENT':
        return await this.prisma.student.updateMany({
          where: { id: userId, refreshToken: { not: null } },
          data: { refreshToken: null },
        });
      case 'TUTOR':
        return await this.prisma.tutor.updateMany({
          where: { id: userId, refreshToken: { not: null } },
          data: { refreshToken: null },
        });
      case 'SUPER_ADMIN':
      case 'SUB_ADMIN':
        return await this.prisma.admin.updateMany({
          where: { id: userId, refreshToken: { not: null } },
          data: { refreshToken: null },
        });
      default:
        // Unknown/legacy role: don't throw; clear cookie already done by controller
        return { count: 0 };
    }
  }

  /** Unified refresh: validate RT and issue new tokens. Role from RT payload. */
  async refresh(
    id: number,
    role: UserRole,
    refreshToken: string,
  ): Promise<Tokens> {
    switch (role) {
      case 'STUDENT': {
        const student = await this.prisma.student.findUnique({
          where: { id },
        });
        if (!student?.refreshToken)
          throw new UnauthorizedException('Access Denied!');
        const matches = await bcrypt.compare(
          refreshToken,
          student.refreshToken,
        );
        if (!matches) throw new UnauthorizedException('Access Denied!');
        const tokens = await this.getTokens(student.id, student.email, 'STUDENT');
        await this.updateRT(student.id, tokens.refresh_token, 'STUDENT');
        return tokens;
      }
      case 'TUTOR': {
        const tutor = await this.prisma.tutor.findUnique({
          where: { id },
        });
        if (!tutor?.refreshToken)
          throw new UnauthorizedException('Access Denied!');
        const matches = await bcrypt.compare(refreshToken, tutor.refreshToken);
        if (!matches) throw new UnauthorizedException('Access Denied!');
        const tokens = await this.getTokens(tutor.id, tutor.email, 'TUTOR');
        await this.updateRT(tutor.id, tokens.refresh_token, 'TUTOR');
        return tokens;
      }
      case 'SUPER_ADMIN':
      case 'SUB_ADMIN': {
        const admin = await this.prisma.admin.findUnique({
          where: { id },
        });
        if (!admin?.refreshToken)
          throw new UnauthorizedException('Access Denied!');
        const matches = await bcrypt.compare(refreshToken, admin.refreshToken);
        if (!matches) throw new UnauthorizedException('Access Denied!');
        const tokens = await this.getTokens(admin.id, admin.email, admin.role);
        await this.updateRT(admin.id, tokens.refresh_token, admin.role);
        return tokens;
      }
      default:
        throw new BadRequestException('Invalid role');
    }
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

  async updateRT(userId: number, rt: string, role: UserRole) {
    const hashed = await this.hashData(rt);
    switch (role) {
      case 'STUDENT':
        await this.prisma.student.update({
          where: { id: userId },
          data: { refreshToken: hashed },
        });
        break;
      case 'TUTOR':
        await this.prisma.tutor.update({
          where: { id: userId },
          data: { refreshToken: hashed },
        });
        break;
      case 'SUPER_ADMIN':
      case 'SUB_ADMIN':
        await this.prisma.admin.update({
          where: { id: userId },
          data: { refreshToken: hashed },
        });
        break;
      default:
        throw new BadRequestException('Invalid role');
    }
  }

  hashData(data: string) {
    return bcrypt.hash(data, 10);
  }

  async getTokens(
    userId: number,
    email: string,
    role: UserRole,
  ): Promise<Tokens> {
    const payload = { sub: userId, email, role };
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.AT_SECRET_KEY,
        expiresIn: '1h',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.RT_SECRET_KEY,
        expiresIn: '7d',
      }),
    ]);
    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  // Admin sign-in (separate form). Returns tokens and admin role.
  async adminSignin(dto: SigninDto): Promise<[Tokens, UserRole]> {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (!admin) throw new UnauthorizedException('Access Denied!');
    const passwordMatches = await bcrypt.compare(dto.password, admin.password);
    if (!passwordMatches) throw new UnauthorizedException('Access Denied!');
    const tokens = await this.getTokens(admin.id, admin.email, admin.role);
    await this.updateRT(admin.id, tokens.refresh_token, admin.role);
    return [tokens, admin.role];
  }

  // Tutor Functions

  async tutorSignup(
    dto: TutorSignupDto,
    image?: Express.Multer.File,
  ): Promise<Tokens> {
    // Check if tutor with the email already exists
    const tutor = await this.prisma.tutor.findUnique({
      where: { email: dto.email },
    });
    if (tutor) throw new BadRequestException('Tutor already exists!');

    // Upload the image to Cloudinary if provided
    let imagePath: string | undefined;
    if (image) {
      try {
        console.log('Starting Cloudinary upload for tutor signup...');
        const uploadedImage = await this.tutorsService.uploadImageToCloudinary(
          image,
        );
        console.log('Cloudinary upload successful:', uploadedImage?.secure_url);
        if (!uploadedImage || !uploadedImage.secure_url) {
          throw new BadRequestException('Image upload failed - no URL returned');
        }
        imagePath = uploadedImage.secure_url;
      } catch (error: any) {
        console.error('Cloudinary upload error:', error);
        throw new BadRequestException(
          error.message || 'Image upload failed. Please check Cloudinary configuration.',
        );
      }
    }

    // Store tutor details in the database
    const password = await this.hashData(dto.password);
    const newTutor = await this.prisma.tutor.create({
      data: {
        email: dto.email,
        password,
        phoneNumber: dto.phoneNumber,
        name: dto.name,
        bio: dto.bio,
        qualifications: dto.qualifications,
        imagePath,
        approved: false, // Tutors need admin approval
      },
    });
    const tokens = await this.getTokens(newTutor.id, newTutor.email, 'TUTOR');
    await this.updateRT(newTutor.id, tokens.refresh_token, 'TUTOR');
    return tokens;
  }
}
