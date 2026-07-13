import { Module } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  providers: [PayoutsService, ATStrategy],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}
