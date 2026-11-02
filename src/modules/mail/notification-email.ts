export function notificationAddress(recipient: { email: string; personalEmail?: string | null }) {
  const preferred = recipient.personalEmail?.trim().toLowerCase();
  return preferred || recipient.email.trim().toLowerCase();
}

export function notificationLink(link: string, base = 'https://enakoos.com') {
  return new URL(link, base.endsWith('/') ? base : base + '/').toString();
}

export function escapeEmailText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>');
}
