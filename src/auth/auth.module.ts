import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ATStrategy } from './strategies/at.strategy';
import { RTStrategy } from './strategies/rt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [JwtModule.register({}), AdminModule],
  providers: [AuthService, ATStrategy, RTStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
