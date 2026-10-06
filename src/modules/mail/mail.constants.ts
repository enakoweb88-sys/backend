export const VERIFIED_EMAIL_DOMAIN = 'mail.enakoos.com';
export const DEFAULT_REPLY_TO = 'support@enakoos.com';

export const EMAIL_SENDERS = {
  SECURITY: 'security@enakoos.com',
  NOTIFICATIONS: 'notifications@enakoos.com',
  KYC: 'kyc@enakoos.com',
  CASH: 'cash@enakoos.com',
  NOREPLY: 'noreply@enakoos.com',
  SUPPORT: 'support@enakoos.com',
  HELP: 'help@enakoos.com',
  CONTACT: 'contact@enakoos.com',
} as const;

export type EmailSenderType = keyof typeof EMAIL_SENDERS;

export const EMAIL_DISPLAY_NAMES: Record<EmailSenderType, string> = {
  SECURITY: 'ENAKO Security',
  NOTIFICATIONS: 'ENAKO Notifications',
  KYC: 'ENAKO KYC Team',
  CASH: 'ENAKO Cash Desk',
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
