import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { generate } from 'randomstring';
// import { validateSocketPayload } from 'src/utils/validate';
const clientIdToRecvCodes = new Map();
const recvCodeToFiles = new Map();

@WebSocketGateway()
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  clients: Set<Socket> = new Set();

  // 客户端连接事件
  handleConnection(client: Socket, ...args: any[]) {
    this.clients.add(client);
    console.log(`Client connected: ${client.id}`, args);
  }

  // 客户端断开连接事件
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.clients.delete(client);
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, params: { type: string; payload: any }) {
    // if (validateSocketPayload(payload)) {
    //   console.error('received not string message: ', JSON.stringify(payload));
    //   return;
    // }
    if (!this.clients.has(client)) {
      console.error('onMessage error, client not found for id: ', client.id);
      return;
    }
    const { type, payload } = params;
    switch (type) {
      case 'c2s_signal': {
        const { clientId, ...rest } = payload;
        const targetClient = Array.from(this.clients).find(
          (c) => c.id === clientId,
        );
        console.log(clientId, 'test');
        if (!targetClient) {
          client.send({
            type: 's2c_error',
            payload: { message: '对方不在线' },
          });
        }

        targetClient.send({
          type: 's2c_signal',
          payload: {
            sourceClientId: client.id,
            ...rest,
          },
        });
        break;
      }
      default: {
        this.handleClientMessage(client, params);
      }
    }
    // console.log(`Received message: ${payload} from ${client.id}`);
    // // 可以使用this.server来发射事件到客户端
    // this.server.emit('message', payload);
  }

  getId() {
    return generate({ charset: 'numeric', length: 8 });
  }

  handleClientMessage(client: Socket, params: { type: string; payload: any }) {
    const { type, payload } = params;
    switch (type) {
      case 'c2s_open': {
        client.send({
          type: 's2c_open',
          payload: {
            id: client.id,
          },
        });
      }

      case 'c2s_prepare_send': {
        const { files, message } = payload;
        const recvCode = getRandomString(6);
        recvCodeToFiles.set(recvCode, {
          clientId: client.id,
          message,
          files,
        });
        clientIdToRecvCodes.set(client.id, recvCode);
        client.send({
          type: 's2c_prepare_send',
          payload: {
            recvCode,
          },
        });
        break;
      }

      case 'c2s_delete_recv_code': {
        const { recvCode } = payload;

        recvCodeToFiles.delete(recvCode);
        break;
      }

      // 客户端发送前 校验 code
      case 'c2s_prepare_recv': {
        const { recvCode } = payload;

        const uploadInfo = recvCodeToFiles.get(recvCode);
        if (uploadInfo) {
          client.send({
            type: 's2c_prepare_recv',
            payload: {
              message: uploadInfo.message,
              files: uploadInfo.files,
              clientId: uploadInfo.clientId,
            },
          });
        } else {
          client.send({
            type: 's2c_error',
            payload: {
              message: '收件码无效',
            },
          });
        }
        break;
      }
    }
  }
}

function getRandomString(len: number) {
  return generate({ charset: 'numeric', length: len });
}
