import { Module } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [StudentsModule],
  providers: [WishlistService, ATStrategy],
  controllers: [WishlistController],
})
export class WishlistModule {}
