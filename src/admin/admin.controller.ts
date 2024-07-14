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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Admin, ROLE } from '@prisma/client';
import { AtGuard } from '../common/guards/at.guard';
import { CreateAdminDto } from './dto/create-admin.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
  @Post('create_admin')
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
