import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Notification, NOTIFICATIONTYPE } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/at.strategy';

export interface NotifyParams {
  type: NOTIFICATIONTYPE;
  title: string;
  message: string;
  link?: string;
}

const PAGE_SIZE = 20;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an in-app notification for a student. Best-effort: a failure here
   * is logged but never propagated, so it can't break the triggering action.
   */
  async notifyStudent(
    studentId: number,
    params: NotifyParams,
  ): Promise<Notification | null> {
    return this.create({ studentId, ...params });
  }

  /** Creates an in-app notification for a tutor. Best-effort (see notifyStudent). */
  async notifyTutor(
    tutorId: number,
    params: NotifyParams,
  ): Promise<Notification | null> {
    return this.create({ tutorId, ...params });
  }

  private async create(data: {
    studentId?: number;
    tutorId?: number;
    type: NOTIFICATIONTYPE;
    title: string;
    message: string;
    link?: string;
  }): Promise<Notification | null> {
    try {
      return await this.prisma.notification.create({
        data: {
          studentId: data.studentId ?? null,
          tutorId: data.tutorId ?? null,
          type: data.type,
          title: data.title,
          message: data.message,
          link: data.link ?? null,
        },
      });
    } catch (err) {
      this.logger.error('Failed to create notification', err as Error);
      return null;
    }
  }

  /** Filter that scopes notifications to the current user, by role. */
  private ownerWhere(user: JwtPayload) {
    if (user.role === 'STUDENT') return { studentId: user.sub };
    if (user.role === 'TUTOR') return { tutorId: user.sub };
    // Admins have no personal notification feed.
    return { id: -1 };
  }

  async list(user: JwtPayload, page = 1) {
    const where = this.ownerWhere(user);
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, read: false } }),
    ]);
    return { items, total, unread, page, pageSize: PAGE_SIZE };
  }

  async unreadCount(user: JwtPayload): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { ...this.ownerWhere(user), read: false },
    });
    return { count };
  }

  async markRead(id: number, user: JwtPayload): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, ...this.ownerWhere(user) },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(user: JwtPayload): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.ownerWhere(user), read: false },
      data: { read: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}
