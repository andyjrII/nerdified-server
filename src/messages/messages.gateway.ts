import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { DirectMessage, CourseChatMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/strategies/at.strategy';

/** Identity attached to an authenticated socket. */
type SocketUser = { id: number; role: 'STUDENT' | 'TUTOR' };

function allowedOrigins(): string[] {
  const fromEnv = process.env.FRONTEND_BASE_URL
    ? process.env.FRONTEND_BASE_URL.split(',').map((u) => u.trim())
    : [];
  const devOrigins = ['http://localhost:3101'];
  return process.env.NODE_ENV === 'production'
    ? fromEnv.length
      ? fromEnv
      : devOrigins
    : [...new Set([...fromEnv, ...devOrigins])];
}

/** Reads a cookie value out of a raw Cookie header. */
function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Real-time messaging over socket.io.
 *
 * Auth: the browser's `access_token` cookie rides along on the handshake
 * (credentials: true), same JWT the REST API uses; `handshake.auth.token` is
 * accepted as a fallback for non-browser clients. Unauthenticated sockets are
 * disconnected immediately.
 *
 * Rooms: every socket joins its personal room (`student:{id}` / `tutor:{id}`),
 * which is where direct-message events are delivered. Course chat rooms
 * (`course:{id}`) are joined on request after a membership check.
 *
 * Events emitted: `direct:new`, `direct:read`, `course:new`.
 */
@WebSocketGateway({
  cors: { origin: allowedOrigins(), credentials: true },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket): void {
    const user = this.authenticate(client);
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.user = user;
    void client.join(this.personalRoom(user.role, user.id));
  }

  handleDisconnect(): void {
    // Rooms are cleaned up automatically by socket.io.
  }

  private authenticate(client: Socket): SocketUser | null {
    const token =
      cookieValue(client.handshake.headers.cookie, 'access_token') ??
      (typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null);
    if (!token) return null;
    try {
      const payload = verify(
        token,
        process.env.AT_SECRET_KEY as string,
      ) as unknown as JwtPayload;
      const role = String(payload.role).toUpperCase();
      if (role !== 'STUDENT' && role !== 'TUTOR') return null;
      const id = typeof payload.sub === 'number' ? payload.sub : Number(payload.sub);
      if (!Number.isFinite(id)) return null;
      return { id, role: role as SocketUser['role'] };
    } catch {
      return null;
    }
  }

  private personalRoom(role: 'STUDENT' | 'TUTOR', id: number): string {
    return `${role.toLowerCase()}:${id}`;
  }

  // ---------- Course chat rooms ----------

  @SubscribeMessage('course:join')
  async joinCourseRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { courseId: number },
  ): Promise<{ joined: boolean }> {
    const user = client.data.user as SocketUser | undefined;
    const courseId = Number(body?.courseId);
    if (!user || !Number.isFinite(courseId)) return { joined: false };

    const isMember =
      user.role === 'TUTOR'
        ? !!(await this.prisma.course.findFirst({
            where: { id: courseId, tutorId: user.id },
            select: { id: true },
          }))
        : !!(await this.prisma.courseEnrollment.findFirst({
            where: {
              courseId,
              studentId: user.id,
              status: { in: ['STARTED', 'FINISHED'] },
            },
            select: { id: true },
          }));
    if (!isMember) return { joined: false };

    await client.join(`course:${courseId}`);
    return { joined: true };
  }

  @SubscribeMessage('course:leave')
  async leaveCourseRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { courseId: number },
  ): Promise<void> {
    const courseId = Number(body?.courseId);
    if (Number.isFinite(courseId)) await client.leave(`course:${courseId}`);
  }

  // ---------- Emit helpers (called by MessagesService) ----------

  /** Delivers a new direct message to both participants' personal rooms. */
  emitDirectMessage(message: DirectMessage): void {
    try {
      for (const room of this.directMessageRooms(message)) {
        this.server.to(room).emit('direct:new', message);
      }
    } catch (err) {
      this.logger.error('Failed to emit direct:new', err as Error);
    }
  }

  /** Notifies both participants that a message was read. */
  emitDirectMessageRead(message: DirectMessage): void {
    try {
      for (const room of this.directMessageRooms(message)) {
        this.server.to(room).emit('direct:read', {
          id: message.id,
          readAt: message.readAt,
        });
      }
    } catch (err) {
      this.logger.error('Failed to emit direct:read', err as Error);
    }
  }

  /** Delivers a new course chat message to the course room. */
  emitCourseMessage(message: CourseChatMessage): void {
    try {
      this.server.to(`course:${message.courseId}`).emit('course:new', message);
    } catch (err) {
      this.logger.error('Failed to emit course:new', err as Error);
    }
  }

  private directMessageRooms(message: DirectMessage): string[] {
    const rooms: string[] = [];
    if (message.studentSenderId)
      rooms.push(this.personalRoom('STUDENT', message.studentSenderId));
    if (message.tutorSenderId)
      rooms.push(this.personalRoom('TUTOR', message.tutorSenderId));
    if (message.studentReceiverId)
      rooms.push(this.personalRoom('STUDENT', message.studentReceiverId));
    if (message.tutorReceiverId)
      rooms.push(this.personalRoom('TUTOR', message.tutorReceiverId));
    return rooms;
  }
}
