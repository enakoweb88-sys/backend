export interface EmailTemplateConfig {
  badge?: string;
  badgeColor?: string; // hex color for badge accent (default #001f5b)
  headerTitle?: string; // e.g. "ENAKO OS"
  headerSubtitle?: string; // e.g. "Security & Access Sentinel" or "Compliance & KYC Desk"
  recipientName?: string;
  headline?: string;
  messageHtml: string;
  keyDetails?: Array<{ label: string; value: string; isHighlight?: boolean }>;
  detailSectionTitle?: string;
  calloutNote?: {
    title?: string;
    text: string;
    variant?: 'info' | 'success' | 'warning' | 'danger';
  };
  ctaButton?: {
    label: string;
    url: string;
    color?: string;
  };
  footerNote?: string;
}

/**
 * Generates an unboxed, modern editorial email template on a plain background.
 * Avoids rigid boxed containers and artificial cards for a high-end, clean brand feel (Stripe/Linear style).
 */
export function buildBrandedEmail(config: EmailTemplateConfig): string {
  const badgeColor = config.badgeColor || '#001f5b';
  const headerTitle = config.headerTitle || 'ENAKO';
  const headerSubtitle = config.headerSubtitle || 'Cloud Operating System';

  // Key Details section (rendered as a sleek, borderless typographic list on plain background)
  let detailsHtml = '';
  if (config.keyDetails && config.keyDetails.length > 0) {
    const rows = config.keyDetails
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; width: 38%; vertical-align: top;">
            ${item.label}
          </td>
          <td style="padding: 10px 0; font-size: 14px; color: ${item.isHighlight ? '#0f172a' : '#1e293b'}; font-weight: ${item.isHighlight ? '700' : '500'}; vertical-align: top;">
            ${item.value}
          </td>
        </tr>
      `,
      )
      .join('');

    detailsHtml = `
      <div style="margin: 28px 0 20px 0;">
        ${config.detailSectionTitle ? `<div style="font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px;">${config.detailSectionTitle}</div>` : ''}
        <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Elegant accent note (using a single vertical brand line instead of a heavy box)
  let noteHtml = '';
  if (config.calloutNote) {
    let accentColor = '#001f5b';
    let textColor = '#334155';
    if (config.calloutNote.variant === 'success') accentColor = '#16a34a';
    else if (config.calloutNote.variant === 'warning') accentColor = '#eab308';
    else if (config.calloutNote.variant === 'danger') accentColor = '#dc2626';

    noteHtml = `
      <div style="margin: 24px 0; padding-left: 16px; border-left: 3px solid ${accentColor};">
        ${config.calloutNote.title ? `<div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${config.calloutNote.title}</div>` : ''}
        <div style="font-size: 13px; line-height: 1.6; color: ${textColor};">${config.calloutNote.text}</div>
      </div>
    `;
  }

  // CTA Button
  let ctaHtml = '';
  if (config.ctaButton) {
    const btnBg = config.ctaButton.color || '#001f5b';
    const btnText = '#ffffff';
    ctaHtml = `
      <div style="margin: 32px 0 24px 0;">
        <a href="${config.ctaButton.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: ${btnBg}; color: ${btnText}; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; letter-spacing: 0.02em;">
          ${config.ctaButton.label} &rarr;
        </a>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${config.headline || headerTitle}</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.65; -webkit-font-smoothing: antialiased;">
  <!-- Plain Canvas Wrapper (No card borders, no gray enclosure) -->
  <div style="max-width: 560px; margin: 0 auto;">

    <!-- MINIMALIST BRAND HEADER -->
    <div style="padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle;">
            <span style="font-size: 18px; font-weight: 900; letter-spacing: 0.06em; color: #0f172a; text-transform: uppercase;">
              ${headerTitle}
            </span>
            <span style="font-size: 18px; font-weight: 900; color: #001f5b;">.</span>
            <div style="font-size: 11px; font-weight: 600; color: #94a3b8; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px;">
              ${headerSubtitle}
            </div>
          </td>
          ${
            config.badge
              ? `
          <td style="text-align: right; vertical-align: middle;">
            <span style="display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 3px 10px; border-radius: 20px;">
              ${config.badge}
            </span>
          </td>
          `
              : ''
          }
        </tr>
      </table>
    </div>

    <!-- MAIN EDITORIAL CONTENT -->
    <div style="padding-top: 28px; padding-bottom: 20px;">
      ${config.recipientName ? `<p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 16px 0;">Hello ${config.recipientName},</p>` : ''}
      
      ${config.headline ? `<h1 style="font-size: 21px; font-weight: 800; color: #0f172a; margin: 0 0 18px 0; line-height: 1.35; letter-spacing: -0.01em;">${config.headline}</h1>` : ''}

      <div style="font-size: 15px; line-height: 1.7; color: #334155;">
        ${config.messageHtml}
      </div>

      ${detailsHtml}
      ${noteHtml}
      ${ctaHtml}
    </div>

    <!-- MANDATORY SUPPORT & BRAND FOOTER -->
    <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #f1f5f9; font-size: 12px; line-height: 1.6; color: #64748b;">
      <p style="margin: 0 0 10px 0; color: #0f172a; font-weight: 600;">
        To contact us back, you can write us or send us an email at <a href="mailto:support@enakoos.com" style="color: #00adb2; text-decoration: none; font-weight: 700;">support@enakoos.com</a>.
      </p>

      ${config.footerNote ? `<p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 11px;">${config.footerNote}</p>` : ''}

      <p style="margin: 16px 0 0 0; font-size: 11px; color: #cbd5e1;">
        ENAKO Cloud System • Corporate Operations &amp; Compliance<br/>
        &copy; ${new Date().getFullYear()} ENAKO OS. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}
