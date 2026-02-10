import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { RtGuard } from '../common/guards/rt.guard';
import { AtGuard } from '../common/guards/at.guard';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../common/decorators/public.decorator';
import { Tokens } from './types/tokens.type';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Student } from '@prisma/client';
import { TutorSignupDto } from './dto/tutor-signup.dto';
import { JwtPayload } from './strategies/at.strategy';

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches RT expiry)
};

const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 1000, // 1 hour in ms (matches AT expiry)
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @UploadedFile() image: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ email: string; role: string }> {
    if (!image) {
      throw new BadRequestException('Image is required');
    }
    const { access_token, refresh_token } = await this.authService.signup(
      dto,
      image,
    );
    res.cookie('refresh_token', refresh_token, refreshCookieOptions);
    res.cookie('access_token', access_token, accessCookieOptions);
    return { email: dto.email, role: 'STUDENT' };
  }

  /** Unified sign-in for student and tutor. Body must include role (STUDENT | TUTOR). */
  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signin(dto);
    const { access_token, refresh_token } = result;
    const approved = 'approved' in result ? result.approved : undefined;
    res.cookie('refresh_token', refresh_token, refreshCookieOptions);
    res.cookie('access_token', access_token, accessCookieOptions);
    return { email: dto.email, role: dto.role, approved };
  }

  /** Unified sign-out. Requires valid access token (identity and role from JWT). */
  @UseGuards(AtGuard)
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  async signout(
    @GetCurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('refresh_token');
    res.clearCookie('access_token');
    const id = typeof user.sub === 'number' ? user.sub : Number(user.sub);
    const role = user?.role;
    const r = role != null ? String(role).toUpperCase() : '';
    const validRoles = ['STUDENT', 'TUTOR', 'SUPER_ADMIN', 'SUB_ADMIN'];
    if (validRoles.includes(r)) {
      await this.authService.signout(id, r as any);
    }
    return { message: 'Signed out' };
  }

  /** Unified refresh. Requires refresh token cookie. Role from JWT. */
  @UseGuards(RtGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @GetCurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) throw new BadRequestException('No refresh token found');
    const id = typeof user.sub === 'number' ? user.sub : Number(user.sub);
    const tokens = await this.authService.refresh(id, user.role, refreshToken);
    res.cookie('refresh_token', tokens.refresh_token, refreshCookieOptions);
    res.cookie('access_token', tokens.access_token, accessCookieOptions);
    return { message: 'Token refreshed' };
  }

  @UseGuards(AtGuard)
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: UpdatePasswordDto,
  ): Promise<Student | undefined> {
    return await this.authService.changePassword(dto);
  }

  @Public()
  @Post('admin/signin')
  @HttpCode(HttpStatus.OK)
  async adminSignin(
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const [tokens, role] = await this.authService.adminSignin(dto);
    res.cookie('refresh_token', tokens.refresh_token, refreshCookieOptions);
    res.cookie('access_token', tokens.access_token, accessCookieOptions);
    return { email: dto.email, role };
  }

  @Public()
  @Post('tutor/signup')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.CREATED)
  async tutorSignup(
    @Body() dto: TutorSignupDto,
    @UploadedFile() image: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ email: string; role: string }> {
    const { access_token, refresh_token } =
      await this.authService.tutorSignup(dto, image);
    res.cookie('refresh_token', refresh_token, refreshCookieOptions);
    res.cookie('access_token', access_token, accessCookieOptions);
    return { email: dto.email, role: 'TUTOR' };
  }

  /** Returns current user from access token cookie. Used by client to establish auth state. */
  @UseGuards(AtGuard)
  @Get('me')
  async me(@GetCurrentUser() user: JwtPayload) {
    return { email: user.email, role: user.role };
  }
}
