import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { RtGuard } from '../common/guards/rt.guard';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../common/decorators/public.decorator';
import { Tokens } from './types/tokens.type';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Student } from '@prisma/client';
import { AdminSignupDto } from './dto/admin-signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /*
   * Signup endpoint for Students
   */
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto): Promise<Tokens> {
    return await this.authService.signup(dto);
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
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
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
   * Signout endpoint for Student
   */
  @Public()
  @Post('signout')
  @HttpCode(HttpStatus.OK)
  async signout(@Query('email') email: string) {
    return await this.authService.signout(email);
  }

  /*
   * Refresh endpoint to get the Access Token using the Refresh Token
   */
  @Public()
  @UseGuards(RtGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @GetCurrentUserId() id: number,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ): Promise<Tokens> {
    return await this.authService.refresh(id, refreshToken);
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

  //Admin Endpoints

  /*
   * Signup endpoint for Super Admin
   */
  @Public()
  @Post('admin_signup')
  @HttpCode(HttpStatus.CREATED)
  async adminSignup(@Body() dto: AdminSignupDto): Promise<[Tokens, string]> {
    return await this.authService.adminSignup(dto);
  }

  /*
   * Signin endpoint for Admin
   */
  @Public()
  @Post('admin_signin')
  @HttpCode(HttpStatus.OK)
  async adminSignin(@Body() dto: SigninDto): Promise<[Tokens, string]> {
    return await this.authService.adminSignin(dto);
  }

  /*
   * Signout endpoint for Admin
   */
  @Public()
  @Post('admin_signout')
  @HttpCode(HttpStatus.OK)
  async adminSignout(@Query('email') email: string) {
    return await this.authService.adminSignout(email);
  }

  /*
   * Refresh endpoint for Admin to get Access Token using Refresh Token
   */
  @Public()
  @UseGuards(RtGuard)
  @Post('admin_refresh')
  @HttpCode(HttpStatus.OK)
  async adminRefresh(
    @GetCurrentUserId() id: number,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ): Promise<Tokens> {
    return await this.authService.adminRefresh(id, refreshToken);
  }
}
