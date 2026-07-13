import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from './notifications.service';

const DEFAULT_LEAD_MINUTES = 60;

const upcomingSessionInclude = {
  course: { select: { title: true } },
  tutor: { select: { id: true, name: true, email: true } },
  bookings: {
    where: { status: { not: 'CANCELLED' as const } },
    include: { student: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.SessionInclude;

type UpcomingSession = Prisma.SessionGetPayload<{
  include: typeof upcomingSessionInclude;
}>;

/**
 * Scheduled job that sends CLASS_REMINDER notifications (in-app + email) to
 * the tutor and every booked student of sessions starting soon.
 *
 * Runs every 5 minutes; the reminder window is CLASS_REMINDER_LEAD_MINUTES
 * (default 60). `Session.reminderSentAt` guarantees each session is only
 * reminded once, even across overlapping runs or multiple server instances.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private readonly leadMinutes =
    Number(process.env.CLASS_REMINDER_LEAD_MINUTES) || DEFAULT_LEAD_MINUTES;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendClassReminders(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + this.leadMinutes * 60_000);

    const sessions = await this.prisma.session.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSentAt: null,
        startTime: { gt: now, lte: windowEnd },
      },
      include: upcomingSessionInclude,
    });
    if (!sessions.length) return;

    let sent = 0;
    for (const session of sessions) {
      // Claim the session before sending so a concurrent run can't double-send.
      const claimed = await this.prisma.session.updateMany({
        where: { id: session.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claimed.count === 0) continue;

      try {
        await this.remindParticipants(session);
        sent += 1;
      } catch (err) {
        this.logger.error(
          `Failed to send reminders for session ${session.id}`,
          err as Error,
        );
      }
    }
    if (sent > 0) {
      this.logger.log(`Sent class reminders for ${sent} upcoming session(s)`);
    }
  }

  private async remindParticipants(session: UpcomingSession): Promise<void> {
    const sessionTitle = session.title ?? 'Your class';
    const courseTitle = session.course.title;
    const startsAt = session.startTime.toUTCString();
    const heading = 'Upcoming class reminder';
    const detail = `${sessionTitle} for ${courseTitle} starts at ${startsAt}.`;
    const baseUrl = process.env.FRONTEND_BASE_URL ?? '';

    await Promise.all([
      ...session.bookings.map(async (booking) => {
        await this.notifications.notifyStudent(booking.student.id, {
          type: 'CLASS_REMINDER',
          title: heading,
          message: detail,
          link: '/student/sessions',
        });
        void this.mail.sendEmail({
          to: booking.student.email,
          toName: booking.student.name,
          subject: `Reminder: ${courseTitle} class starting soon`,
          html: this.mail.layout(
            heading,
            `<p>Your class for <strong>${courseTitle}</strong> is starting soon.</p><p>${detail}</p>`,
            `${baseUrl}/student/sessions`,
            'View my sessions',
          ),
        });
      }),
      (async () => {
        await this.notifications.notifyTutor(session.tutor.id, {
          type: 'CLASS_REMINDER',
          title: heading,
          message: detail,
          link: '/tutor/courses',
        });
        void this.mail.sendEmail({
          to: session.tutor.email,
          toName: session.tutor.name,
          subject: `Reminder: your ${courseTitle} class is starting soon`,
          html: this.mail.layout(
            heading,
            `<p>You have a class for <strong>${courseTitle}</strong> starting soon.</p><p>${detail}</p>`,
            `${baseUrl}/tutor/courses`,
            'View my courses',
          ),
        });
      })(),
    ]);
  }
}
