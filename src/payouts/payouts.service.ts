import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PAYOUTSTATUS, TutorPayout } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

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

    if (status === 'COMPLETED') {
      await this.notifications.notifyTutor(existing.tutorId, {
        type: 'PAYMENT',
        title: 'Payout completed',
        message: `${formatCurrency(Number(payout.netAmount))} has been paid out to you.`,
        link: '/tutor/earnings',
      });
    } else if (status === 'FAILED') {
      await this.notifications.notifyTutor(existing.tutorId, {
        type: 'PAYMENT',
        title: 'Payout failed',
        message:
          'A payout attempt failed. Our team will retry — no action needed.',
        link: '/tutor/earnings',
      });
    }

    return payout;
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
