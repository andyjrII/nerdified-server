import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { ATStrategy } from '../auth/strategies/at.strategy';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [StudentsController],
  providers: [StudentsService, ATStrategy],
  exports: [StudentsService],
})
export class StudentsModule {}
