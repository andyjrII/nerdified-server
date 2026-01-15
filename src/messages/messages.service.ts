import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DirectMessage, CourseChatMessage } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

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

    return await this.prisma.directMessage.create({
      data,
    });
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

  async markMessageAsRead(messageId: number): Promise<DirectMessage> {
    return await this.prisma.directMessage.update({
      where: { id: messageId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
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

    return await this.prisma.courseChatMessage.create({
      data: {
        courseId,
        senderId,
        senderType,
        message,
        isAnnouncement,
      },
    });
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
