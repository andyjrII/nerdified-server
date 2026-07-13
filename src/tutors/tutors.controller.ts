import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { AtGuard } from '../common/guards/at.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { Tutor, UserRole } from '@prisma/client';
import { UpdateTimezoneDto } from './dto/update-timezone.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

// Every tutor route is scoped to the authenticated tutor (identity from the
// JWT), so the whole controller is TUTOR-only. Admin tutor management lives
// under the separate /admin/tutors routes.
@UseGuards(AtGuard, RolesGuard)
@Roles(UserRole.TUTOR)
@Controller('tutors')
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  /*
   * Get tutor profile by email
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getTutor(@Query('email') email: string): Promise<Tutor | undefined> {
    return await this.tutorsService.getTutor(email);
  }

  /*
   * Get current tutor profile (from JWT)
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentTutor(
    @GetCurrentUserId() id: number,
  ): Promise<Tutor | undefined> {
    return await this.tutorsService.getTutorById(id);
  }

  /*
   * Update current tutor timezone (for scheduling and availability)
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(
    @GetCurrentUserId() id: number,
    @Body() dto: UpdateTimezoneDto,
  ): Promise<Tutor> {
    if (dto.timezone !== undefined) {
      return await this.tutorsService.updateTimezone(id, dto.timezone);
    }
    return await this.tutorsService.getTutorById(id);
  }

  /*
   * Get earnings summary for current tutor
   */
  @Get('me/earnings')
  @HttpCode(HttpStatus.OK)
  async getMyEarnings(@GetCurrentUserId() tutorId: number) {
    return await this.tutorsService.getEarnings(tutorId);
  }

  /*
   * Get students enrolled in current tutor's courses
   */
  @Get('me/students')
  @HttpCode(HttpStatus.OK)
  async getMyStudents(@GetCurrentUserId() tutorId: number) {
    return await this.tutorsService.getStudents(tutorId);
  }

  /*
   * List banks (name + code) for the payout bank picker
   */
  @Get('banks')
  @HttpCode(HttpStatus.OK)
  async getBanks() {
    return await this.tutorsService.listBanks();
  }

  /*
   * Get current tutor's payout bank details
   */
  @Get('me/bank')
  @HttpCode(HttpStatus.OK)
  async getMyBank(@GetCurrentUserId() id: number) {
    return await this.tutorsService.getBankDetails(id);
  }

  /*
   * Set current tutor's payout bank account (verified + recipient created)
   */
  @Patch('me/bank')
  @HttpCode(HttpStatus.OK)
  async updateMyBank(
    @GetCurrentUserId() id: number,
    @Body() dto: UpdateBankDto,
  ) {
    return await this.tutorsService.updateBankDetails(id, dto);
  }
}
