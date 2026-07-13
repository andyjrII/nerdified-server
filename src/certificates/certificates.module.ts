import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { ATStrategy } from '../auth/strategies/at.strategy';

@Module({
  controllers: [CertificatesController],
  providers: [CertificatesService, ATStrategy],
  exports: [CertificatesService],
})
export class CertificatesModule {}
