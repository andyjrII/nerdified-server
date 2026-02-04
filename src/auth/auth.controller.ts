import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { RtGuard } from '../common/guards/rt.guard';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../common/decorators/public.decorator';
import { Tokens } from './types/tokens.type';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Student, Tutor } from '@prisma/client';
import { TutorSignupDto } from './dto/tutor-signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /*
   * Signup endpoint for Students
   */
  @Public()
  @Post('signup')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() dto: SignupDto,
    @UploadedFile() image: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Tokens> {
    console.log(image);
    if (!image) {
      throw new BadRequestException('Image is required');
    }
    const { access_token, refresh_token } = await this.authService.signup(
      dto,
      image,
    );
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    });
    return {
      access_token,
      refresh_token,
    };
  }

  /*
   * Signin endpoint for Student
   */
  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Tokens> {
    const { access_token, refresh_token } = await this.authService.signin(dto);
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    });
    return {
      access_token,
      refresh_token,
    };
  }

  /*
   * Signout endpoint for Student
   * Requires query param: email (string, non-empty)
   */
  @Public()
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  async signout(
    @Query('email') email: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const trimmed = typeof email === 'string' ? email.trim() : '';
    if (!trimmed) {
      throw new BadRequestException('Email is required for signout');
    }
    res.clearCookie('refresh_token');
    return await this.authService.signout(trimmed);
  }

  /*
   * Refresh endpoint for Student
   */
  @UseGuards(RtGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @GetCurrentUserId() id: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Tokens> {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new BadRequestException('No refresh token found');
    const { access_token, refresh_token } = await this.authService.refresh(
      id,
      refreshToken,
    );
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    });

    return {
      access_token,
      refresh_token,
    };
  }

  /*
   * Allows Students change their password
   */
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: UpdatePasswordDto,
  ): Promise<Student | undefined> {
    return await this.authService.changePassword(dto);
  }

  /*
   * Signin endpoint for Admin
   */
  @Public()
  @Post('admin/signin')
  @HttpCode(HttpStatus.OK)
  async adminSignin(
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<[Tokens, string]> {
    const response = await this.authService.adminSignin(dto);
    res.cookie('refresh_token', response[0].refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
    return response;
  }

  /*
   * Signout endpoint for Admin
   * Requires query param: email (string, non-empty)
   */
  @Public()
  @Post('admin/signout')
  @HttpCode(HttpStatus.OK)
  async adminSignout(
    @Query('email') email: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const trimmed = typeof email === 'string' ? email.trim() : '';
    if (!trimmed) {
      throw new BadRequestException('Email is required for signout');
    }
    res.clearCookie('refresh_token');
    return await this.authService.adminSignout(trimmed);
  }

  /*
   * Refresh endpoint for Admin
   */
  @UseGuards(RtGuard)
  @Post('admin/refresh')
  @HttpCode(HttpStatus.OK)
  async adminRefresh(
    @GetCurrentUserId() id: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Tokens> {
    const refreshToken = req.cookies['refresh_token'];
    const { access_token, refresh_token } = await this.authService.adminRefresh(
      id,
      refreshToken,
    );
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return {
      access_token,
      refresh_token,
    };
  }

  /*
   * Signup endpoint for Tutors
   */
  @Public()
  @Post('tutor/signup')
  @UseInterceptors(FileInterceptor('image'))
  @HttpCode(HttpStatus.CREATED)
  async tutorSignup(
    @Body() dto: TutorSignupDto,
    @UploadedFile() image: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Tokens> {
    const { access_token, refresh_token } = await this.authService.tutorSignup(
      dto,
      image,
    );
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    });
    return {
      access_token,
      refresh_token,
    };
  }

  /*
   * Signin endpoint for Tutor
   */
  @Public()
  @Post('tutor/signin')
  @HttpCode(HttpStatus.OK)
  async tutorSignin(
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<[Tokens, boolean]> {
    const response = await this.authService.tutorSignin(dto);
    res.cookie('refresh_token', response[0].refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    });
    return response;
  }

  /*
   * Signout endpoint for Tutor
   * Query param: email (string, non-empty). If missing, still clears cookie.
   */
  @Public()
  @Post('tutor/signout')
  @HttpCode(HttpStatus.OK)
  async tutorSignout(
    @Query('email') email: string | string[],
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('refresh_token');
    const raw = Array.isArray(email) ? email[0] : email;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (trimmed) {
      return await this.authService.tutorSignout(trimmed);
    }
    return { count: 0 };
  }

  /*
   * Refresh endpoint for Tutor
   */
  @UseGuards(RtGuard)
  @Post('tutor/refresh')
  @HttpCode(HttpStatus.OK)
  async tutorRefresh(
    @GetCurrentUserId() id: number,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Tokens> {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new BadRequestException('No refresh token found');
    const { access_token, refresh_token } = await this.authService.tutorRefresh(
      id,
      refreshToken,
    );
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    });

    return {
      access_token,
      refresh_token,
    };
  }
}
