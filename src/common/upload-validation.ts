import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { previewMimeType } from './document-content';
export const uploadLimits = { fileSize: 10 * 1024 * 1024, files: 8, fields: 40, fieldSize: 128 * 1024, parts: 48 };
export function safeUpload(file: Express.Multer.File, restricted = false) {
  if (!file?.buffer?.length || file.size !== file.buffer.length || file.size > uploadLimits.fileSize || typeof file.originalname !== 'string' || file.originalname.length > 240 || /[\x00-\x1f/\\]/.test(file.originalname)) throw new BadRequestException('Invalid file or filename');
  if (/\.(exe|com|dll|bat|cmd|ps1|js|mjs|cjs|html?|svg|sh|php|scr|lnk)$/i.test(file.originalname) || file.buffer.subarray(0, 2).toString() === 'MZ' || file.buffer.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))) throw new BadRequestException('Executable content is not accepted');
  const mimeType = previewMimeType(file.originalname, file.buffer);
  if (restricted && !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) throw new BadRequestException('Upload a PDF, PNG, JPEG or WebP document with valid file content');
  const extension: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'text/plain;charset=utf-8': 'txt' };
  return { mimeType, fileName: randomUUID() + '.' + (extension[mimeType] || 'bin') };
}
