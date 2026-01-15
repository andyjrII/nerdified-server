import {
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
import { Admin, Blog, ROLE, Tutor } from '@prisma/client';
import { AtGuard } from '../common/guards/at.guard';
import { CreateAdminDto } from './dto/create-admin.dto';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /*
   * Returns all Blog Posts using pagination, search, startDate & endDate
   */
  @UseGuards(AtGuard)
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
  @UseGuards(AtGuard)
  @Get('payments_month')
  @HttpCode(HttpStatus.OK)
  async getPaymentsByMonth(): Promise<any> {
    return await this.adminService.getPaymentsByMonth();
  }

  /*
   * Get all tutors with pagination and search (Admin only)
   */
  @UseGuards(AtGuard)
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
  @UseGuards(AtGuard)
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
  @UseGuards(AtGuard)
  @Patch('tutors/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectTutor(
    @Param('id', ParseIntPipe) tutorId: number,
  ): Promise<Tutor> {
    return await this.adminService.rejectTutor(tutorId);
  }

  /*
   * Returns an Admin
   */
  @UseGuards(AtGuard)
  @Get(':email')
  @HttpCode(HttpStatus.OK)
  async getAdmin(@Param('email') email: string): Promise<Admin> {
    return await this.adminService.getAdmin(email);
  }

  //Super Admin Endpoint

  /*
   * Creates SUB Admin
   */
  @UseGuards(AtGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() dto: CreateAdminDto): Promise<Admin> {
    return await this.adminService.createAdmin(dto);
  }

  /*
   * Allows SUPER Admin access to all the Admins using pagination & search as filter
   */
  @UseGuards(AtGuard)
  @Get('all/:page')
  @HttpCode(HttpStatus.OK)
  async getAdmins(
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
    @Query('role') role: ROLE,
  ): Promise<Object> {
    return await this.adminService.getAdmins(page, search, role);
  }

  /*
   * Allows the SUPER Admin to delete an Admin by Id & returns the remaining Admins
   */
  @UseGuards(AtGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Query('role') role: ROLE,
  ): Promise<Admin | undefined> {
    return await this.adminService.deleteAdmin(id, role);
  }
}
