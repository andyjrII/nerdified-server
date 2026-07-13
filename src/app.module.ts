import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { StudentsModule } from './students/students.module';
import { CoursesModule } from './courses/courses.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { BlogModule } from './blog/blog.module';
import { AdminModule } from './admin/admin.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { TutorsModule } from './tutors/tutors.module';
import { SessionsModule } from './sessions/sessions.module';
import { MessagesModule } from './messages/messages.module';
import { LivekitModule } from './livekit/livekit.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PayoutsModule } from './payouts/payouts.module';
import { CertificatesModule } from './certificates/certificates.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    AdminModule,
    BlogModule,
    CoursesModule,
    PrismaModule,
    StudentsModule,
    TutorsModule,
    SessionsModule,
    LivekitModule,
    MessagesModule,
    ReviewsModule,
    WishlistModule,
    MailModule,
    NotificationsModule,
    PayoutsModule,
    CertificatesModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
