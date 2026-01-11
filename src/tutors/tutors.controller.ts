import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { AtGuard } from '../common/guards/at.guard';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { Tutor } from '@prisma/client';

@Controller('tutors')
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  /*
   * Get tutor profile by email
   */
  @UseGuards(AtGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  async getTutor(@Query('email') email: string): Promise<Tutor | undefined> {
    return await this.tutorsService.getTutor(email);
  }

  /*
   * Get current tutor profile (from JWT)
   */
  @UseGuards(AtGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentTutor(
    @GetCurrentUserId() id: number,
  ): Promise<Tutor | undefined> {
    return await this.tutorsService.getTutorById(id);
  }
}
