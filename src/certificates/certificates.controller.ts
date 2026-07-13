import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { AtGuard } from '../common/guards/at.guard';
import { GetCurrentUser } from '../common/decorators/get-current-user.decorator';
import { JwtPayload } from '../auth/strategies/at.strategy';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  /** Current student's issued certificates. */
  @UseGuards(AtGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async myCertificates(@GetCurrentUser() user: JwtPayload) {
    return this.certificatesService.getMyCertificates(Number(user.sub));
  }

  /**
   * Issue (or fetch) the certificate for a completed enrollment. Student for
   * their own enrollment, or admin for any.
   */
  @UseGuards(AtGuard)
  @Post('enrollment/:enrollmentId/issue')
  @HttpCode(HttpStatus.OK)
  async issue(
    @Param('enrollmentId', ParseIntPipe) enrollmentId: number,
    @GetCurrentUser() user: JwtPayload,
  ) {
    return this.certificatesService.issueForUser(
      enrollmentId,
      Number(user.sub),
      String(user.role),
    );
  }
}
