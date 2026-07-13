import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DirectMessage, CourseChatMessage } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagesGateway } from './messages.gateway';

export interface ConversationPartner {
  id: number;
  type: 'STUDENT' | 'TUTOR';
  name: string | null;
  email: string;
  imagePath: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: MessagesGateway,
  ) {}

  // Direct Messages (Student ↔ Tutor)
  async sendDirectMessage(
    senderId: number,
    senderType: 'STUDENT' | 'TUTOR',
    receiverId: number,
    receiverType: 'STUDENT' | 'TUTOR',
    message: string,
  ): Promise<DirectMessage> {
    const data: any = {
      senderType,
      message,
    };

    if (senderType === 'STUDENT') {
      data.studentSenderId = senderId;
    } else {
      data.tutorSenderId = senderId;
    }

    if (receiverType === 'STUDENT') {
      data.studentReceiverId = receiverId;
    } else {
      data.tutorReceiverId = receiverId;
    }

    const created = await this.prisma.directMessage.create({
      data,
    });

    // Deliver in real time to both participants' sockets.
    this.gateway.emitDirectMessage(created);

    // Notify the recipient of the new message (in-app, best-effort).
    const preview =
      message.length > 80 ? `${message.slice(0, 77)}...` : message;
    const notifyParams = {
      type: 'MESSAGE' as const,
      title: 'New message',
      message: preview,
    };
    if (receiverType === 'STUDENT') {
      await this.notifications.notifyStudent(receiverId, {
        ...notifyParams,
        link: '/student/messages',
      });
    } else {
      await this.notifications.notifyTutor(receiverId, {
        ...notifyParams,
        link: '/tutor/messages',
      });
    }

    return created;
  }

  async getDirectMessages(
    userId: number,
    userType: 'STUDENT' | 'TUTOR',
  ): Promise<DirectMessage[]> {
    const where: any = {};

    if (userType === 'STUDENT') {
      where.OR = [
        { studentSenderId: userId },
        { studentReceiverId: userId },
      ];
    } else {
      where.OR = [
        { tutorSenderId: userId },
        { tutorReceiverId: userId },
      ];
    }

    return await this.prisma.directMessage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getConversation(
    userId: number,
    userType: 'STUDENT' | 'TUTOR',
    otherUserId: number,
    otherUserType: 'STUDENT' | 'TUTOR',
  ): Promise<DirectMessage[]> {
    const where: any = {};

    if (userType === 'STUDENT' && otherUserType === 'TUTOR') {
      where.OR = [
        {
          studentSenderId: userId,
          tutorReceiverId: otherUserId,
        },
        {
          studentReceiverId: userId,
          tutorSenderId: otherUserId,
        },
      ];
    } else if (userType === 'TUTOR' && otherUserType === 'STUDENT') {
      where.OR = [
        {
          tutorSenderId: userId,
          studentReceiverId: otherUserId,
        },
        {
          tutorReceiverId: userId,
          studentSenderId: otherUserId,
        },
      ];
    } else {
      throw new BadRequestException(
        'Direct messages are only between students and tutors',
      );
    }

    return await this.prisma.directMessage.findMany({
      where,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async markMessageAsRead(
    messageId: number,
    userId: number,
    userType: 'STUDENT' | 'TUTOR',
  ): Promise<DirectMessage> {
    // Only the receiver of a message may mark it read.
    const receiverWhere =
      userType === 'STUDENT'
        ? { studentReceiverId: userId }
        : { tutorReceiverId: userId };
    const message = await this.prisma.directMessage.findFirst({
      where: { id: messageId, ...receiverWhere },
    });
    if (!message) throw new NotFoundException('Message not found');

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
    this.gateway.emitDirectMessageRead(updated);
    return updated;
  }

  /**
   * Conversation partners for the messages UI: everyone the user has messaged
   * with, plus everyone they could message (students: tutors of their
   * enrollments; tutors: students enrolled in their courses), with the last
   * message and unread count per partner.
   */
  async getPartners(
    userId: number,
    userType: 'STUDENT' | 'TUTOR',
  ): Promise<ConversationPartner[]> {
    const partnerType: 'STUDENT' | 'TUTOR' =
      userType === 'STUDENT' ? 'TUTOR' : 'STUDENT';
    const messages = await this.getDirectMessages(userId, userType);

    // Fold messages into per-partner stats (messages are newest-first).
    const stats = new Map<
      number,
      { lastMessage: string; lastMessageAt: Date; unreadCount: number }
    >();
    for (const m of messages) {
      const partnerId =
        userType === 'STUDENT'
          ? m.tutorSenderId ?? m.tutorReceiverId
          : m.studentSenderId ?? m.studentReceiverId;
      if (!partnerId) continue;
      const existing = stats.get(partnerId);
      if (!existing) {
        stats.set(partnerId, {
          lastMessage: m.message,
          lastMessageAt: m.createdAt,
          unreadCount: 0,
        });
      }
      const receivedByMe =
        userType === 'STUDENT'
          ? m.studentReceiverId === userId
          : m.tutorReceiverId === userId;
      if (receivedByMe && !m.read) {
        stats.get(partnerId)!.unreadCount += 1;
      }
    }

    // Everyone the user could start a conversation with, via enrollments.
    let contactIds: number[];
    if (userType === 'STUDENT') {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: { studentId: userId, status: { in: ['STARTED', 'FINISHED'] } },
        select: { course: { select: { tutorId: true } } },
      });
      contactIds = enrollments.map((e) => e.course.tutorId);
    } else {
      const enrollments = await this.prisma.courseEnrollment.findMany({
        where: {
          course: { tutorId: userId },
          status: { in: ['STARTED', 'FINISHED'] },
        },
        select: { studentId: true },
      });
      contactIds = enrollments.map((e) => e.studentId);
    }

    const partnerIds = [...new Set([...stats.keys(), ...contactIds])];
    if (!partnerIds.length) return [];

    const select = {
      id: true,
      name: true,
      email: true,
      imagePath: true,
    };
    const records =
      partnerType === 'TUTOR'
        ? await this.prisma.tutor.findMany({
            where: { id: { in: partnerIds } },
            select,
          })
        : await this.prisma.student.findMany({
            where: { id: { in: partnerIds } },
            select,
          });

    const partners: ConversationPartner[] = records.map((r) => {
      const s = stats.get(r.id);
      return {
        id: r.id,
        type: partnerType,
        name: r.name,
        email: r.email,
        imagePath: r.imagePath,
        lastMessage: s?.lastMessage ?? null,
        lastMessageAt: s?.lastMessageAt ?? null,
        unreadCount: s?.unreadCount ?? 0,
      };
    });

    // Active conversations first (newest), then contacts alphabetically.
    partners.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt)
        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
    return partners;
  }

  // Course Chat Messages
  async sendCourseChatMessage(
    courseId: number,
    senderId: number,
    senderType: 'STUDENT' | 'TUTOR',
    message: string,
    isAnnouncement: boolean = false,
  ): Promise<CourseChatMessage> {
    // Validate course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Only tutors can send announcements
    if (isAnnouncement && senderType !== 'TUTOR') {
      throw new BadRequestException('Only tutors can send announcements');
    }

    const created = await this.prisma.courseChatMessage.create({
      data: {
        courseId,
        senderId,
        senderType,
        message,
        isAnnouncement,
      },
    });
    // Deliver in real time to everyone in the course chat room.
    this.gateway.emitCourseMessage(created);
    return created;
  }

  async getCourseChatMessages(courseId: number): Promise<CourseChatMessage[]> {
    return await this.prisma.courseChatMessage.findMany({
      where: {
        courseId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
