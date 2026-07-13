import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';
import { SessionsModule } from '../sessions/sessions.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [SessionsModule, CertificatesModule],
  providers: [CoursesService, ATStrategy],
  controllers: [CoursesController],
})
export class CoursesModule {}
