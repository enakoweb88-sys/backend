import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection } from 'net';
export async function scanDocument(bytes: Buffer, config: ConfigService) {
    const host = config.get<string>('FILE_SCANNER_HOST'), port = Number(config.get<string>('FILE_SCANNER_PORT') || 3310);
    // clamd has no application authentication: permit a local sidecar only.
    if (!['127.0.0.1', '::1'].includes(host || '') || !Number.isInteger(port) || port < 1 || port > 65535) throw new ServiceUnavailableException('Private document scanning is not configured');
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host, port }); let response = '', finished = false;
      const finish = (error?: Error) => { if (finished) return; finished = true; socket.destroy(); error ? reject(error) : resolve(); };
      socket.setTimeout(15000, () => finish(new ServiceUnavailableException('Document scanner timeout')));
      socket.on('error', () => finish(new ServiceUnavailableException('Document scanner unavailable')));
      socket.on('close', () => { if (!finished) finish(new ServiceUnavailableException('Document scan incomplete')); });
      socket.on('data', part => { response += part.toString(); if (response.length > 2048) return finish(new ServiceUnavailableException('Invalid scanner response')); if (response.includes('\0')) { if (/^stream: OK\0$/.test(response)) finish(); else if (/ FOUND\0$/.test(response)) finish(new BadRequestException('Document failed security scanning')); else finish(new ServiceUnavailableException('Document could not be scanned')); } });
      socket.once('connect', () => { socket.write('zINSTREAM\0'); for (let offset = 0; offset < bytes.length; offset += 65536) { const chunk = bytes.subarray(offset, offset + 65536), length = Buffer.alloc(4); length.writeUInt32BE(chunk.length); socket.write(length); socket.write(chunk); } socket.write(Buffer.alloc(4)); });
    });
  }
