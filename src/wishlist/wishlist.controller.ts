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

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @UseGuards(AtGuard)
  @Post('add')
  async addToWishlist(@Body() dto: WishListDto) {
    return this.wishlistService.addToWishlist(dto);
  }

  @UseGuards(AtGuard)
  @Delete('remove')
  async removeFromWishlist(@Body() dto: WishListDto) {
    return this.wishlistService.removeFromWishlist(dto);
  }

  @UseGuards(AtGuard)
  @Get(':studentId')
  async getWishlist(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.wishlistService.getWishlist(studentId);
  }

  @UseGuards(AtGuard)
  @Get('total/:email')
  async getWishlistNumber(@Param('email') email: string): Promise<number> {
    return this.wishlistService.getWishlistNumber(email);
  }
}
