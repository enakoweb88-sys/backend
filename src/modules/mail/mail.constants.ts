export const VERIFIED_EMAIL_DOMAIN = 'mail.enakoos.com';
export const DEFAULT_REPLY_TO = 'support@enakoos.com';

export const EMAIL_SENDERS = {
  SECURITY: 'security@mail.enakoos.com',
  NOTIFICATIONS: 'notifications@mail.enakoos.com',
  KYC: 'kyc@mail.enakoos.com',
  NOREPLY: 'noreply@mail.enakoos.com',
  SUPPORT: 'support@mail.enakoos.com',
  HELP: 'help@mail.enakoos.com',
  CONTACT: 'contact@mail.enakoos.com',
} as const;

export type EmailSenderType = keyof typeof EMAIL_SENDERS;

export const EMAIL_DISPLAY_NAMES: Record<EmailSenderType, string> = {
  SECURITY: 'ENAKO Security',
  NOTIFICATIONS: 'ENAKO Notifications',
  KYC: 'ENAKO KYC Team',
  NOREPLY: 'ENAKO OS',
  SUPPORT: 'ENAKO Support',
  HELP: 'ENAKO Helpdesk',
  CONTACT: 'ENAKO Team',
};

/**
 * Returns a RFC-5322 formatted sender string: "Display Name" <address@mail.enakoos.com>
 */
export function getSenderAddress(type: EmailSenderType, customDisplayName?: string): string {
  const email = EMAIL_SENDERS[type];
  const name = customDisplayName || EMAIL_DISPLAY_NAMES[type];
  return `"${name}" <${email}>`;
}
