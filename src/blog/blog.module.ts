import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogController } from './blog.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  providers: [BlogService, ATStrategy],
  controllers: [BlogController],
})
export class BlogModule {}
