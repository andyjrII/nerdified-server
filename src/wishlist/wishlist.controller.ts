import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishListDto } from './dto/wishlist.dto';
import { AtGuard } from '../common/guards/at.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Wishlist, UserRole } from '@prisma/client';

// Wishlist is a student-only feature.
@UseGuards(AtGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post('add')
  async addToWishlist(@Body() dto: WishListDto) {
    return this.wishlistService.addToWishlist(dto);
  }

  @Delete('remove')
  async removeFromWishlist(@Body() dto: WishListDto) {
    return this.wishlistService.removeFromWishlist(dto);
  }

  @Get(':studentId')
  async getWishlistById(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.wishlistService.getWishlistById(studentId);
  }

  @Get('email/:email')
  async getWishlistByEmail(@Param('email') email: string): Promise<Wishlist[]> {
    return this.wishlistService.getWishlistByEmail(email);
  }

  @Get('total/:email')
  async getWishlistNumber(@Param('email') email: string): Promise<number> {
    return this.wishlistService.getWishlistNumber(email);
  }
}
