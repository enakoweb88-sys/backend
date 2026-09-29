import { EmailSenderType } from './mail.constants';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  senderType?: EmailSenderType;
  from?: string;
  replyTo?: string;
  tag?: string;
  actorId?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
