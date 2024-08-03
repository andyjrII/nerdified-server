import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { StudentsModule } from './students/students.module';
import { CoursesModule } from './courses/courses.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { APP_GUARD } from '@nestjs/core';
import { AtGuard } from './common/guards/at.guard';
import { BlogModule } from './blog/blog.module';
import { AdminModule } from './admin/admin.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WishlistModule } from './wishlist/wishlist.module';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    BlogModule,
    CoursesModule,
    PrismaModule,
    StudentsModule,
    ReviewsModule,
    WishlistModule,
  ],
  providers: [
    PrismaService,
    /*
    {
      provide: APP_GUARD,
      useClass: AtGuard,
    }, 
    */
  ],
})
export class AppModule {}
