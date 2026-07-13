import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Tokens } from './types/tokens.type';
import { JwtService } from '@nestjs/jwt/dist';
import { SigninDto } from './dto/signin.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Student, Tutor, UserRole } from '@prisma/client';
import { StudentsService } from '../students/students.service';
import { TutorsService } from '../tutors/tutors.service';
import { TutorSignupDto } from './dto/tutor-signup.dto';
import { MailService } from '../mail/mail.service';

/** First configured frontend origin, for links in emails. */
function frontendBaseUrl(): string {
  const first = process.env.FRONTEND_BASE_URL?.split(',')[0]?.trim();
  return first || 'http://localhost:3101';
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private studentsService: StudentsService,
    private tutorsService: TutorsService,
    private mail: MailService,
  ) {}

  // ---------- Email verification ----------

  /**
   * Sends a verification email with a 3-day signed-JWT link (stateless — no
   * token table). Best-effort: failures are logged by MailService, never thrown.
   */
  async sendVerificationEmail(
    userId: number,
    email: string,
    name: string | null,
    role: 'STUDENT' | 'TUTOR',
  ): Promise<void> {
    const token = await this.jwtService.signAsync(
      { sub: userId, email, role, typ: 'email_verify' },
      { secret: process.env.AT_SECRET_KEY, expiresIn: '3d' },
    );
    const link = `${frontendBaseUrl()}/verify-email?token=${token}`;
    void this.mail.sendEmail({
      to: email,
      toName: name ?? undefined,
      subject: 'Verify your email address',
      html: this.mail.layout(
        'Verify your email',
        `<p>Hi ${name ?? 'there'},</p><p>Please confirm this email address for your Nerdified account. The link is valid for 3 days.</p>`,
        link,
        'Verify my email',
      ),
    });
  }

  /** Consumes a verification token and marks the account's email verified. */
  async verifyEmail(
    token: string,
  ): Promise<{ verified: boolean; email: string; role: string }> {
    let payload: { sub: number; email: string; role: string; typ: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.AT_SECRET_KEY,
      });
    } catch {
      throw new BadRequestException('Verification link is invalid or expired');
    }
    if (
      payload.typ !== 'email_verify' ||
      (payload.role !== 'STUDENT' && payload.role !== 'TUTOR')
    ) {
      throw new BadRequestException('Verification link is invalid or expired');
    }

    const where = { id: payload.sub, email: payload.email };
    if (payload.role === 'STUDENT') {
      const updated = await this.prisma.student.updateMany({
        where: { ...where, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
      // Zero rows means either already verified (fine) or no such account.
      if (updated.count === 0) {
        const exists = await this.prisma.student.findFirst({ where });
        if (!exists)
          throw new BadRequestException('Verification link is invalid or expired');
      }
    } else {
      const updated = await this.prisma.tutor.updateMany({
        where: { ...where, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
      if (updated.count === 0) {
        const exists = await this.prisma.tutor.findFirst({ where });
        if (!exists)
          throw new BadRequestException('Verification link is invalid or expired');
      }
    }
    return { verified: true, email: payload.email, role: payload.role };
  }

  /** Re-sends the verification email for the authenticated user. */
  async resendVerification(
    userId: number,
    role: UserRole,
  ): Promise<{ message: string }> {
    const r = String(role).toUpperCase();
    if (r !== 'STUDENT' && r !== 'TUTOR') {
      return { message: 'Nothing to verify' };
    }
    const account =
      r === 'STUDENT'
        ? await this.prisma.student.findUnique({ where: { id: userId } })
        : await this.prisma.tutor.findUnique({ where: { id: userId } });
    if (!account) throw new UnauthorizedException('Access Denied!');
    if (account.emailVerifiedAt) return { message: 'Email already verified' };
    await this.sendVerificationEmail(
      account.id,
      account.email,
      account.name,
      r as 'STUDENT' | 'TUTOR',
    );
    return { message: 'Verification email sent' };
  }

  /** Whether the user's email is verified (admins are implicitly verified). */
  async isEmailVerified(userId: number, role: UserRole): Promise<boolean> {
    const r = String(role).toUpperCase();
    if (r === 'STUDENT') {
      const s = await this.prisma.student.findUnique({
        where: { id: userId },
        select: { emailVerifiedAt: true },
      });
      return !!s?.emailVerifiedAt;
    }
    if (r === 'TUTOR') {
      const t = await this.prisma.tutor.findUnique({
        where: { id: userId },
        select: { emailVerifiedAt: true },
      });
      return !!t?.emailVerifiedAt;
    }
    return true;
  }

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
    await this.sendVerificationEmail(
      newStudent.id,
      newStudent.email,
      newStudent.name,
      'STUDENT',
    );
    return tokens;
  }

  /**
   * Google OAuth sign-in: finds the student/tutor by verified Google email or
   * creates the account (random password — access is via Google; the profile
   * picture becomes the avatar). New tutors still require admin approval.
   */
  async googleSignin(
    profile: { email: string; name: string | null; picture: string | null },
    role: 'STUDENT' | 'TUTOR',
  ): Promise<Tokens & { approved: boolean }> {
    if (role === 'STUDENT') {
      let student = await this.prisma.student.findUnique({
        where: { email: profile.email },
      });
      if (!student) {
        const password = await this.hashData(randomBytes(32).toString('hex'));
        student = await this.prisma.student.create({
          data: {
            email: profile.email,
            password,
            name: profile.name,
            address: '',
            imagePath: profile.picture,
            emailVerifiedAt: new Date(), // Google email is verified
          },
        });
      } else if (!student.emailVerifiedAt) {
        // Signing in via Google proves ownership of this email.
        await this.prisma.student.update({
          where: { id: student.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
      const tokens = await this.getTokens(student.id, student.email, 'STUDENT');
      await this.updateRT(student.id, tokens.refresh_token, 'STUDENT');
      return { ...tokens, approved: true };
    }

    let tutor = await this.prisma.tutor.findUnique({
      where: { email: profile.email },
    });
    if (!tutor) {
      const password = await this.hashData(randomBytes(32).toString('hex'));
      tutor = await this.prisma.tutor.create({
        data: {
          email: profile.email,
          password,
          name: profile.name,
          imagePath: profile.picture,
          emailVerifiedAt: new Date(), // Google email is verified
        },
      });
    } else if (!tutor.emailVerifiedAt) {
      // Signing in via Google proves ownership of this email.
      await this.prisma.tutor.update({
        where: { id: tutor.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    const tokens = await this.getTokens(tutor.id, tutor.email, 'TUTOR');
    await this.updateRT(tutor.id, tokens.refresh_token, 'TUTOR');
    return { ...tokens, approved: tutor.approved };
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

  /**
   * Role-aware password change for the authenticated user. Identity comes from
   * the JWT (userId + role); the correct table is updated based on role.
   */
  async changeMyPassword(
    userId: number,
    role: UserRole,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const account = await this.findAccountByRole(userId, role);
    if (!account) throw new UnauthorizedException('Access Denied!');

    const matches = await bcrypt.compare(oldPassword, account.password);
    if (!matches) throw new UnauthorizedException('Current password is incorrect');

    const password = await this.hashData(newPassword);
    switch (role) {
      case 'STUDENT':
        await this.prisma.student.update({ where: { id: userId }, data: { password } });
        break;
      case 'TUTOR':
        await this.prisma.tutor.update({ where: { id: userId }, data: { password } });
        break;
      case 'SUPER_ADMIN':
      case 'SUB_ADMIN':
        await this.prisma.admin.update({ where: { id: userId }, data: { password } });
        break;
      default:
        throw new UnauthorizedException('Access Denied!');
    }
    return { message: 'Password updated' };
  }

  /** Loads the account row (with password) for a user, by role. */
  private async findAccountByRole(
    userId: number,
    role: UserRole,
  ): Promise<{ password: string } | null> {
    switch (role) {
      case 'STUDENT':
        return this.prisma.student.findUnique({ where: { id: userId } });
      case 'TUTOR':
        return this.prisma.tutor.findUnique({ where: { id: userId } });
      case 'SUPER_ADMIN':
      case 'SUB_ADMIN':
        return this.prisma.admin.findUnique({ where: { id: userId } });
      default:
        return null;
    }
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
    await this.sendVerificationEmail(
      newTutor.id,
      newTutor.email,
      newTutor.name,
      'TUTOR',
    );
    return tokens;
  }
}
