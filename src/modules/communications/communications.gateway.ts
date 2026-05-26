import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class CommunicationsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('message:create')
  broadcast(@MessageBody() payload: unknown) {
    this.server.emit('message:created', payload);
    return payload;
  }

  @SubscribeMessage('announcement:create')
  announcement(@MessageBody() payload: unknown) {
    this.server.emit('announcement:created', payload);
    return payload;
  }
}
