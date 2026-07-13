import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PAYOUTSTATUS, UserRole } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import { AtGuard } from '../common/guards/at.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { UpdatePayoutStatusDto } from './dto/update-payout-status.dto';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  /** Admin: create (disburse) a payout for a tutor. */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Post()
  async create(@Body() dto: CreatePayoutDto) {
    return this.payoutsService.createPayout(dto.tutorId, dto.amount);
  }

  /** Admin: list payouts with optional status / tutor filters. */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('status') status?: PAYOUTSTATUS,
    @Query('tutorId') tutorId?: string,
  ) {
    return this.payoutsService.listPayouts({
      page: page ? Number(page) : 1,
      status: status || undefined,
      tutorId: tutorId ? Number(tutorId) : undefined,
    });
  }

  /** Tutor: own payout history + balance summary. */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.TUTOR)
  @Get('me')
  async myPayouts(@GetCurrentUserId() tutorId: number) {
    return this.payoutsService.getTutorPayouts(tutorId);
  }

  /** Admin: a specific tutor's current balance (for deciding payout amount). */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get('tutor/:tutorId/balance')
  async tutorBalance(@Param('tutorId', ParseIntPipe) tutorId: number) {
    return this.payoutsService.getTutorBalance(tutorId);
  }

  /** Admin: update payout status (PROCESSING / COMPLETED / FAILED). */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayoutStatusDto,
  ) {
    return this.payoutsService.updateStatus(id, dto.status, dto.paymentReference);
  }
}
