import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  /** Full HTML body. A matching plain-text part is derived automatically. */
  html: string;
}

/**
 * Transactional email via Brevo (https://developers.brevo.com).
 *
 * Email is treated as best-effort: if Brevo is unconfigured or the request
 * fails, we log and return false rather than throwing, so a mail problem never
 * blocks the user-facing action (enrollment, messaging, etc.).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey = process.env.BREVO_API_KEY;
  private readonly senderEmail = process.env.BREVO_SENDER_EMAIL;
  private readonly senderName = process.env.BREVO_SENDER_NAME ?? 'Nerdified';
  private readonly endpoint = 'https://api.brevo.com/v3/smtp/email';

  private isConfigured(): boolean {
    if (!this.apiKey || !this.senderEmail) {
      this.logger.warn(
        'Brevo is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL missing). Skipping email.',
      );
      return false;
    }
    return true;
  }

  async sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey as string,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.senderName, email: this.senderEmail },
          to: [{ email: params.to, name: params.toName ?? undefined }],
          subject: params.subject,
          htmlContent: params.html,
          textContent: this.htmlToText(params.html),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => response.statusText);
        this.logger.error(
          `Brevo rejected email to ${params.to}: ${response.status} ${detail}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${params.to}`,
        err as Error,
      );
      return false;
    }
  }

  /** Wraps body content in a simple branded HTML shell. */
  layout(heading: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string): string {
    const button =
      ctaUrl && ctaLabel
        ? `<p style="margin:24px 0;"><a href="${ctaUrl}" style="background:#1e3a8a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${ctaLabel}</a></p>`
        : '';
    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111;">
  <div style="background:linear-gradient(90deg,#1e3a8a,#1e40af);padding:20px;text-align:center;">
    <span style="color:#fff;font-size:20px;font-weight:bold;">Nerdified</span>
  </div>
  <div style="padding:24px;">
    <h2 style="margin-top:0;color:#1e3a8a;">${heading}</h2>
    ${bodyHtml}
    ${button}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="font-size:12px;color:#888;">Learn live. Learn better. — The Nerdified Team</p>
  </div>
</div>`;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
