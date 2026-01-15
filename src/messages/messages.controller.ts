import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AtGuard } from '../common/guards/at.guard';
import { GetCurrentUserId } from '../common/decorators/get-current-userId.decorator';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { SendCourseChatMessageDto } from './dto/send-course-chat-message.dto';
import { DirectMessage, CourseChatMessage, SENDERTYPE } from '@prisma/client';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /*
   * Send a direct message (Student ↔ Tutor)
   */
  @UseGuards(AtGuard)
  @Post('direct')
  @HttpCode(HttpStatus.CREATED)
  async sendDirectMessage(
    @Body() dto: SendDirectMessageDto,
    @GetCurrentUserId() senderId: number,
    @Query('senderType') senderType: SENDERTYPE,
  ): Promise<DirectMessage> {
    return await this.messagesService.sendDirectMessage(
      senderId,
      senderType,
      dto.receiverId,
      dto.receiverType,
      dto.message,
    );
  }

  /*
   * Get all direct messages for current user
   */
  @UseGuards(AtGuard)
  @Get('direct')
  @HttpCode(HttpStatus.OK)
  async getDirectMessages(
    @GetCurrentUserId() userId: number,
    @Query('userType') userType: SENDERTYPE,
  ): Promise<DirectMessage[]> {
    return await this.messagesService.getDirectMessages(userId, userType);
  }

  /*
   * Get conversation with a specific user
   */
  @UseGuards(AtGuard)
  @Get('direct/conversation')
  @HttpCode(HttpStatus.OK)
  async getConversation(
    @GetCurrentUserId() userId: number,
    @Query('userType') userType: SENDERTYPE,
    @Query('otherUserId', ParseIntPipe) otherUserId: number,
    @Query('otherUserType') otherUserType: SENDERTYPE,
  ): Promise<DirectMessage[]> {
    return await this.messagesService.getConversation(
      userId,
      userType,
      otherUserId,
      otherUserType,
    );
  }

  /*
   * Mark a message as read
   */
  @UseGuards(AtGuard)
  @Patch('direct/:messageId/read')
  @HttpCode(HttpStatus.OK)
  async markMessageAsRead(
    @Param('messageId', ParseIntPipe) messageId: number,
  ): Promise<DirectMessage> {
    return await this.messagesService.markMessageAsRead(messageId);
  }

  /*
   * Send a course chat message
   */
  @UseGuards(AtGuard)
  @Post('course')
  @HttpCode(HttpStatus.CREATED)
  async sendCourseChatMessage(
    @Body() dto: SendCourseChatMessageDto,
    @GetCurrentUserId() senderId: number,
    @Query('senderType') senderType: SENDERTYPE,
  ): Promise<CourseChatMessage> {
    return await this.messagesService.sendCourseChatMessage(
      dto.courseId,
      senderId,
      senderType,
      dto.message,
      dto.isAnnouncement || false,
    );
  }

  /*
   * Get course chat messages
   */
  @UseGuards(AtGuard)
  @Get('course/:courseId')
  @HttpCode(HttpStatus.OK)
  async getCourseChatMessages(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<CourseChatMessage[]> {
    return await this.messagesService.getCourseChatMessages(courseId);
  }
}
