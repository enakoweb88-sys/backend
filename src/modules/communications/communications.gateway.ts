import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createHmac } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsService } from './communications.service';
import { GatewayAccess } from '../../common/gateway-access';
import { PostgresThrottlerStorage } from '../../common/postgres-throttler';
import { corsAllowlist } from '../../common/request-security';
import { matchesOsGatewayIdentity } from '../../common/os-gateway-identity';

@WebSocketGateway({ cors: { origin: (origin, callback) => { try { callback(null, !origin || corsAllowlist(new ConfigService()).includes(origin)); } catch { callback(new Error('Origin rejected')); } }, credentials: false }, maxHttpBufferSize: 16384, transports: ['websocket'] })
export class CommunicationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly communications: CommunicationsService, private readonly gateway: GatewayAccess, private readonly config: ConfigService) {}
  async handleConnection(client: Socket) {
    try {
      client.data.token = client.handshake.auth?.token;
      client.data.gateway = await this.gateway.verify(client.handshake.headers['cf-access-jwt-assertion'] || client.handshake.auth?.gatewayAssertion, 'os', client.conn.remoteAddress);
      const user = await this.principal(client); await client.join('user:' + user.sub);
      const timer = setInterval(() => this.revalidateRooms(client).catch(() => client.disconnect(true)), 10000);
      timer.unref(); this.timers.set(client.id, timer);
    } catch { client.disconnect(true); }
  }
  handleDisconnect(client: Socket) { clearInterval(this.timers.get(client.id)); this.timers.delete(client.id); }
  private async principal(client: Socket) {
    if (typeof client.data.token !== 'string') throw Error('Authentication required');
    const user = await this.auth.validateAccessToken(client.data.token);
    if (client.data.gateway && (client.data.gateway.expiresAt <= Date.now() || !matchesOsGatewayIdentity(user, client.data.gateway.email))) throw Error('Gateway session expired');
    return user;
  }
  private async revalidateRooms(client: Socket) {
    const user = await this.principal(client);
    for (const room of client.rooms) if (room.startsWith('channel:') && !(await this.communications.verifyChannelAccess(room.slice(8), user.sub))) await client.leave(room);
    return user;
  }
  private async event(client: Socket) {
    const user = await this.revalidateRooms(client), secret = this.config.get<string>('RATE_LIMIT_HASH_SECRET');
    if (!secret || Buffer.byteLength(secret) < 32) throw Error('Rate limiting unavailable');
    const key = createHmac('sha256', secret).update('ws|' + user.sub).digest('hex');
    if ((await new PostgresThrottlerStorage(this.prisma).increment(key, 60000)).totalHits > 60) throw Error('Event limit exceeded');
    return user;
  }
  private channel(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 200 && !value.startsWith('dm:') && !/[\x00-\x1f]/.test(value); }
  @SubscribeMessage('channel:join')
  async handleJoin(@MessageBody() channel: string, @ConnectedSocket() client: Socket) {
    try { const user = await this.event(client); if (!this.channel(channel) || !(await this.communications.verifyChannelAccess(channel, user.sub))) return { error: 'Access denied' }; await client.join('channel:' + channel); return { joined: channel }; } catch { client.disconnect(true); return { error: 'Session unavailable' }; }
  }
  @SubscribeMessage('channel:leave')
  async handleLeave(@MessageBody() channel: string, @ConnectedSocket() client: Socket) {
    try { await this.event(client); if (!this.channel(channel)) return { error: 'Invalid channel' }; await client.leave('channel:' + channel); return { left: channel }; } catch { client.disconnect(true); return { error: 'Session unavailable' }; }
  }
  @SubscribeMessage('message:send')
  async handleMessage(@MessageBody() payload: { channel: string; content: string }, @ConnectedSocket() client: Socket) {
    try {
      const user = await this.event(client);
      if (!this.channel(payload?.channel) || typeof payload?.content !== 'string' || !payload.content.trim() || payload.content.length > 10000 || !(await this.communications.verifyChannelAccess(payload.channel, user.sub))) return { error: 'Invalid message or channel access' };
      const message = await this.prisma.message.create({ data: { channel: payload.channel, content: payload.content, senderId: user.sub }, include: { sender: { select: { id: true, fullName: true, role: { select: { name: true } } } } } });
      await this.broadcastChannel(payload.channel, message); return message;
    } catch { client.emit('error', { message: 'Message could not be sent' }); return { error: 'Message could not be sent' }; }
  }
  async broadcastChannel(channel: string, message: unknown) {
    if (!this.server) return;
    for (const client of this.server.sockets.sockets.values()) if (client.rooms.has('channel:' + channel)) {
      try { await this.revalidateRooms(client); if (client.rooms.has('channel:' + channel)) client.emit('message:created', message); } catch { client.disconnect(true); }
    }
  }
  async broadcastNotification(userId: string, notification: unknown) {
    if (!this.server) return;
    for (const client of this.server.sockets.sockets.values()) { try { if ((await this.principal(client)).sub === userId) client.emit('notification:new', notification); } catch { client.disconnect(true); } }
  }
  @SubscribeMessage('user:join')
  async handleUserJoin(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    try { const user = await this.event(client); if (userId !== user.sub) return { error: 'Access denied' }; await client.join('user:' + user.sub); return { joined: 'user:' + user.sub }; } catch { client.disconnect(true); return { error: 'Session unavailable' }; }
  }
}
