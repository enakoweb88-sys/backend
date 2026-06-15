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
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class CommunicationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`[WS] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Client disconnected: ${client.id}`);
  }

  /** Client joins a named channel room */
  @SubscribeMessage('channel:join')
  handleJoin(@MessageBody() channel: string, @ConnectedSocket() client: Socket) {
    client.join(`channel:${channel}`);
    return { joined: channel };
  }

  /** Client leaves a channel room */
  @SubscribeMessage('channel:leave')
  handleLeave(@MessageBody() channel: string, @ConnectedSocket() client: Socket) {
    client.leave(`channel:${channel}`);
    return { left: channel };
  }

  /**
   * Receive a new message and persist it, then broadcast to channel room.
   * Payload: { channel, content, senderId, senderName, senderRole }
   */
  @SubscribeMessage('message:send')
  async handleMessage(
    @MessageBody() payload: { channel: string; content: string; senderId: string; senderName?: string; senderRole?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const message = await this.prisma.message.create({
        data: {
          channel: payload.channel,
          content: payload.content,
          senderId: payload.senderId,
        },
        include: {
          sender: { select: { fullName: true, role: { select: { name: true } } } },
        },
      });

      this.server.to(`channel:${payload.channel}`).emit('message:created', message);
      return message;
    } catch (err) {
      client.emit('error', { message: 'Failed to persist message' });
    }
  }

  /** Broadcast a notification payload to a specific user (by userId room) */
  broadcastNotification(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  /** Broadcast a system-wide event to all connected clients */
  broadcastAll(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }

  /** Client joins their personal room for targeted notifications */
  @SubscribeMessage('user:join')
  handleUserJoin(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    client.join(`user:${userId}`);
    return { joined: `user:${userId}` };
  }
}
