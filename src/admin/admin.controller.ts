import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Get,
  UseGuards,
  Query,
  Post,
  Body,
  Patch,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Admin, Tutor, UserRole } from '@prisma/client';
import { AtGuard } from '../common/guards/at.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { SessionsService } from '../sessions/sessions.service';
import { ReviewRequestDto } from '../sessions/dto/review-request.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly sessionsService: SessionsService,
  ) {}

  /*
   * Returns all Blog Posts using pagination, search, startDate & endDate
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get('blogs/:page')
  @HttpCode(HttpStatus.OK)
  async getPosts(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<Object> {
    return await this.adminService.getPosts(page, search, startDate, endDate);
  }

  /*
   * Get total courses, students and products on the site
   */
  @UseGuards(AtGuard)
  @Get('totals')
  @HttpCode(HttpStatus.OK)
  async getTotal(): Promise<Number[]> {
    return await this.adminService.getTotal();
  }

  /*
   * Get total payments for each months
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get('payments_month')
  @HttpCode(HttpStatus.OK)
  async getPaymentsByMonth(): Promise<any> {
    return await this.adminService.getPaymentsByMonth();
  }

  /*
   * Get all tutors with pagination and search (Admin only)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get('tutors/:page')
  @HttpCode(HttpStatus.OK)
  async getTutors(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string = '',
    @Query('approved') approved?: string,
  ): Promise<Object> {
    const approvedFilter =
      approved !== undefined ? approved === 'true' : undefined;
    return await this.adminService.getTutors(page, search, approvedFilter);
  }

  /*
   * Approve a tutor (Admin only)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Patch('tutors/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveTutor(
    @Param('id', ParseIntPipe) tutorId: number,
    @GetCurrentUserId() adminId: number,
  ): Promise<Tutor> {
    return await this.adminService.approveTutor(tutorId, adminId);
  }

  /*
   * Reject a tutor (Admin only)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Patch('tutors/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectTutor(
    @Param('id', ParseIntPipe) tutorId: number,
  ): Promise<Tutor> {
    return await this.adminService.rejectTutor(tutorId);
  }

  /*
   * Get pending reschedule requests (Admin only)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get('reschedule-requests')
  @HttpCode(HttpStatus.OK)
  async getRescheduleRequestsPending() {
    return await this.sessionsService.getRescheduleRequestsPending();
  }

  /*
   * Get pending add-session requests (Admin only)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get('add-session-requests')
  @HttpCode(HttpStatus.OK)
  async getAddSessionRequestsPending() {
    return await this.sessionsService.getAddSessionRequestsPending();
  }

  /*
   * Approve or reject reschedule request (Admin only)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Patch('reschedule-requests/:id')
  @HttpCode(HttpStatus.OK)
  async reviewRescheduleRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewRequestDto,
    @GetCurrentUserId() adminId: number,
  ) {
    if (dto.status !== 'APPROVED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }
    return await this.sessionsService.approveRescheduleRequest(
      id,
      adminId,
      dto.status,
      dto.adminNote,
    );
  }

  /*
   * Approve or reject add-session request (Admin only)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Patch('add-session-requests/:id')
  @HttpCode(HttpStatus.OK)
  async reviewAddSessionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewRequestDto,
    @GetCurrentUserId() adminId: number,
  ) {
    if (dto.status !== 'APPROVED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }
    return await this.sessionsService.approveAddSessionRequest(
      id,
      adminId,
      dto.status,
      dto.adminNote,
    );
  }

  /*
   * Returns an Admin by email (must be after more specific GET routes)
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN)
  @Get(':email')
  @HttpCode(HttpStatus.OK)
  async getAdmin(@Param('email') email: string): Promise<Admin> {
    return await this.adminService.getAdmin(email);
  }

  /*
   * Creates new admin (SUPER_ADMIN only). Body includes role for new admin (SUB_ADMIN or SUPER_ADMIN).
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() dto: CreateAdminDto): Promise<Admin> {
    return await this.adminService.createAdmin(dto);
  }

  /*
   * List all admins with pagination and search (SUPER_ADMIN only).
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get('all/:page')
  @HttpCode(HttpStatus.OK)
  async getAdmins(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
  ): Promise<Object> {
    return await this.adminService.getAdmins(page, search);
  }

  /*
   * Delete an admin by id (SUPER_ADMIN only).
   */
  @UseGuards(AtGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAdmin(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Admin | undefined> {
    return await this.adminService.deleteAdmin(id);
  }
}
