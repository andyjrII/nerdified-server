import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PAYOUTSTATUS, TutorPayout } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { PaystackService } from '../payments/paystack.service';
import { formatCurrency } from '../common/utils/formatCurrency';

const PAGE_SIZE = 20;

/** Statuses that "reserve" gross revenue so it can't be paid out twice. */
const ACTIVE_STATUSES: PAYOUTSTATUS[] = ['PENDING', 'PROCESSING', 'COMPLETED'];

export interface TutorBalance {
  commissionRate: number;
  grossRevenue: number;
  netEarned: number;
  totalPaidOut: number;
  pendingNet: number;
  availableGross: number;
  availableNet: number;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly paystack: PaystackService,
  ) {}

  /** In-app notification for a terminal payout status. */
  private async notifyPayoutStatus(
    tutorId: number,
    status: 'COMPLETED' | 'FAILED',
    netAmount: number,
  ): Promise<void> {
    if (status === 'COMPLETED') {
      await this.notifications.notifyTutor(tutorId, {
        type: 'PAYMENT',
        title: 'Payout completed',
        message: `${formatCurrency(netAmount)} has been paid out to you.`,
        link: '/tutor/earnings',
      });
    } else {
      await this.notifications.notifyTutor(tutorId, {
        type: 'PAYMENT',
        title: 'Payout failed',
        message:
          'A payout attempt failed. Our team will retry — no action needed.',
        link: '/tutor/earnings',
      });
    }
  }

  /** Platform commission as a fraction (0–1). Configurable via env. */
  getCommissionRate(): number {
    const raw = Number(process.env.PLATFORM_COMMISSION_RATE);
    if (!Number.isFinite(raw) || raw < 0 || raw >= 1) return 0.15;
    return raw;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Sum of all verified enrollment payments across a tutor's courses. */
  private async getGrossRevenue(tutorId: number): Promise<number> {
    const agg = await this.prisma.courseEnrollment.aggregate({
      where: { course: { tutorId } },
      _sum: { paidAmount: true },
    });
    return Number(agg._sum.paidAmount ?? 0);
  }

  async getTutorBalance(tutorId: number): Promise<TutorBalance> {
    const rate = this.getCommissionRate();
    const grossRevenue = await this.getGrossRevenue(tutorId);
    const payouts = await this.prisma.tutorPayout.findMany({
      where: { tutorId },
    });

    let settledGross = 0;
    let totalPaidOut = 0;
    let pendingNet = 0;
    for (const p of payouts) {
      if (ACTIVE_STATUSES.includes(p.status)) {
        settledGross += Number(p.amount);
      }
      if (p.status === 'COMPLETED') {
        totalPaidOut += Number(p.netAmount);
      }
      if (p.status === 'PENDING' || p.status === 'PROCESSING') {
        pendingNet += Number(p.netAmount);
      }
    }

    const availableGross = Math.max(0, this.round2(grossRevenue - settledGross));
    return {
      commissionRate: rate,
      grossRevenue: this.round2(grossRevenue),
      netEarned: this.round2(grossRevenue * (1 - rate)),
      totalPaidOut: this.round2(totalPaidOut),
      pendingNet: this.round2(pendingNet),
      availableGross,
      availableNet: this.round2(availableGross * (1 - rate)),
    };
  }

  /**
   * Admin action: create a payout for a tutor. Settles `amount` of gross
   * revenue (or the full available balance if omitted), deducting commission.
   */
  async createPayout(tutorId: number, amount?: number): Promise<TutorPayout> {
    const tutor = await this.prisma.tutor.findUnique({
      where: { id: tutorId },
    });
    if (!tutor) throw new NotFoundException('Tutor not found');

    const balance = await this.getTutorBalance(tutorId);
    if (balance.availableGross <= 0) {
      throw new BadRequestException('Tutor has no available balance to pay out');
    }

    const grossAmount = amount ?? balance.availableGross;
    if (grossAmount > balance.availableGross + 1e-6) {
      throw new BadRequestException(
        `Amount exceeds available balance (${formatCurrency(
          balance.availableGross,
        )})`,
      );
    }

    const rate = balance.commissionRate;
    const commission = this.round2(grossAmount * rate);
    const netAmount = this.round2(grossAmount - commission);

    const payout = await this.prisma.tutorPayout.create({
      data: {
        tutorId,
        amount: this.round2(grossAmount),
        commission,
        netAmount,
        status: 'PENDING',
      },
    });

    await this.notifications.notifyTutor(tutorId, {
      type: 'PAYMENT',
      title: 'Payout initiated',
      message: `A payout of ${formatCurrency(netAmount)} is being processed.`,
      link: '/tutor/earnings',
    });
    if (tutor.email) {
      void this.mail.sendEmail({
        to: tutor.email,
        toName: tutor.name ?? undefined,
        subject: 'Your Nerdified payout is on the way',
        html: this.mail.layout(
          'Payout initiated',
          `<p>We're processing a payout to you.</p>
           <p>Gross: <strong>${formatCurrency(Number(payout.amount))}</strong><br/>
           Platform commission: <strong>${formatCurrency(commission)}</strong><br/>
           You receive: <strong>${formatCurrency(netAmount)}</strong></p>`,
          `${process.env.FRONTEND_BASE_URL ?? ''}/tutor/earnings`,
          'View earnings',
        ),
      });
    }

    return payout;
  }

  async updateStatus(
    id: number,
    status: PAYOUTSTATUS,
    paymentReference?: string,
  ): Promise<TutorPayout> {
    const existing = await this.prisma.tutorPayout.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Payout not found');

    const payout = await this.prisma.tutorPayout.update({
      where: { id },
      data: {
        status,
        paymentReference: paymentReference ?? existing.paymentReference,
        paidAt: status === 'COMPLETED' ? new Date() : existing.paidAt,
      },
    });

    if (status === 'COMPLETED' || status === 'FAILED') {
      await this.notifyPayoutStatus(
        existing.tutorId,
        status,
        Number(payout.netAmount),
      );
    }

    return payout;
  }

  /**
   * Actually disburses a payout via Paystack Transfers. Allowed from PENDING or
   * FAILED (retry). Initiates the transfer to the tutor's saved recipient and
   * moves the payout to PROCESSING (or COMPLETED if Paystack settles instantly).
   * Final confirmation for async transfers arrives via the webhook.
   */
  async disburse(payoutId: number): Promise<TutorPayout> {
    if (!this.paystack.transfersConfigured()) {
      throw new BadRequestException(
        'Payouts are not configured (set PAYSTACK_SECRET_KEY to enable transfers)',
      );
    }
    const payout = await this.prisma.tutorPayout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === 'COMPLETED') {
      throw new BadRequestException('This payout has already been paid out');
    }
    if (payout.status === 'PROCESSING') {
      throw new BadRequestException('A transfer for this payout is in progress');
    }

    const tutor = await this.prisma.tutor.findUnique({
      where: { id: payout.tutorId },
    });
    if (!tutor?.paystackRecipientCode) {
      throw new BadRequestException(
        'This tutor has not set up a payout bank account yet',
      );
    }

    // Fresh reference each attempt so retries are not rejected as duplicates.
    const reference = `nerdified-payout-${payout.id}-${Date.now()}`;
    let result;
    try {
      result = await this.paystack.initiateTransfer({
        amountNaira: Number(payout.netAmount),
        recipientCode: tutor.paystackRecipientCode,
        reference,
        reason: `Nerdified payout #${payout.id}`,
      });
    } catch (err) {
      this.logger.error(
        `Transfer initiation failed for payout ${payout.id}`,
        err as Error,
      );
      await this.prisma.tutorPayout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          failureReason: (err as Error).message ?? 'Transfer initiation failed',
        },
      });
      await this.notifyPayoutStatus(
        payout.tutorId,
        'FAILED',
        Number(payout.netAmount),
      );
      throw new BadRequestException(
        'Could not initiate the transfer with the payment provider',
      );
    }

    const status: PAYOUTSTATUS =
      result.status === 'success'
        ? 'COMPLETED'
        : result.status === 'failed'
          ? 'FAILED'
          : 'PROCESSING';

    const updated = await this.prisma.tutorPayout.update({
      where: { id: payout.id },
      data: {
        status,
        transferCode: result.transferCode || null,
        paymentReference: result.reference,
        paidAt: status === 'COMPLETED' ? new Date() : null,
        failureReason: status === 'FAILED' ? 'Transfer rejected' : null,
      },
    });

    if (status === 'PROCESSING') {
      await this.notifications.notifyTutor(payout.tutorId, {
        type: 'PAYMENT',
        title: 'Payout on the way',
        message: `A payout of ${formatCurrency(Number(payout.netAmount))} is being transferred to your bank.`,
        link: '/tutor/earnings',
      });
    } else {
      await this.notifyPayoutStatus(
        payout.tutorId,
        status as 'COMPLETED' | 'FAILED',
        Number(payout.netAmount),
      );
    }
    return updated;
  }

  /**
   * Finalizes a payout from a Paystack transfer webhook event. Idempotent:
   * only acts when the status actually changes. Signature must be verified by
   * the caller before this runs.
   */
  async handleTransferWebhook(event: {
    event?: string;
    data?: { transfer_code?: string; reference?: string; reason?: string };
  }): Promise<void> {
    const type = event?.event;
    const transferCode = event?.data?.transfer_code;
    const reference = event?.data?.reference;
    if (!type || (!transferCode && !reference)) return;

    const payout = await this.prisma.tutorPayout.findFirst({
      where: {
        OR: [
          ...(transferCode ? [{ transferCode }] : []),
          ...(reference ? [{ paymentReference: reference }] : []),
        ],
      },
    });
    if (!payout) return;

    if (type === 'transfer.success' && payout.status !== 'COMPLETED') {
      await this.prisma.tutorPayout.update({
        where: { id: payout.id },
        data: { status: 'COMPLETED', paidAt: new Date(), failureReason: null },
      });
      await this.notifyPayoutStatus(
        payout.tutorId,
        'COMPLETED',
        Number(payout.netAmount),
      );
    } else if (
      (type === 'transfer.failed' || type === 'transfer.reversed') &&
      payout.status !== 'FAILED'
    ) {
      await this.prisma.tutorPayout.update({
        where: { id: payout.id },
        data: {
          status: 'FAILED',
          failureReason: event.data?.reason ?? type,
        },
      });
      await this.notifyPayoutStatus(
        payout.tutorId,
        'FAILED',
        Number(payout.netAmount),
      );
    }
  }

  async listPayouts(opts: {
    page?: number;
    status?: PAYOUTSTATUS;
    tutorId?: number;
  }) {
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const where = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.tutorId ? { tutorId: opts.tutorId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.tutorPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          tutor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.tutorPayout.count({ where }),
    ]);
    return { items, total, page, pageSize: PAGE_SIZE };
  }

  /** Tutor-facing: their payout history plus current balance summary. */
  async getTutorPayouts(tutorId: number) {
    const [payouts, balance] = await Promise.all([
      this.prisma.tutorPayout.findMany({
        where: { tutorId },
        orderBy: { createdAt: 'desc' },
      }),
      this.getTutorBalance(tutorId),
    ]);
    return { payouts, balance };
  }
}
