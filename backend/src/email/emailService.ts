import { config } from '../config/index.ts';
import { logger } from '../middleware/redactionLogger.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface SentEmailRecord {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  inviteToken: string;
  sentAt: string;
}

export class EmailService {
  private static sentEmails: SentEmailRecord[] = [];

  /**
   * Checks whether an active email provider is configured on the backend.
   */
  static isConfigured(): boolean {
    if (config.NODE_ENV === 'test' || config.EMAIL_PROVIDER === 'test') {
      return true;
    }
    if (config.EMAIL_PROVIDER === 'resend' && config.RESEND_API_KEY) {
      return true;
    }
    if (config.EMAIL_PROVIDER === 'smtp' && config.SMTP_HOST && config.SMTP_USER) {
      return true;
    }
    return false;
  }

  /**
   * Sends a secure, single-use email invitation to access a shared password.
   * NEVER includes the password, encryption keys, or reusable session tokens in the email.
   */
  static async sendItemInvitation(params: {
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    senderEmail: string;
    serviceName: string;
    permission: 'view_copy' | 'edit';
    inviteToken: string;
    expiresAt: string;
  }): Promise<{ messageId: string }> {
    if (!this.isConfigured()) {
      logger.warn(`Email delivery attempted for ${params.recipientEmail} but no email provider is configured.`);
      throw new AppError(
        503,
        'EMAIL_DELIVERY_NOT_CONFIGURED',
        'Email delivery is not configured on the server. Please set RESEND_API_KEY or SMTP credentials to send invitations.'
      );
    }

    const permissionLabel = params.permission === 'edit' ? 'Can edit' : 'Can view & copy';
    const acceptUrl = `${config.APP_URL}/?invite=${encodeURIComponent(params.inviteToken)}`;
    const formattedDate = new Date(params.expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const subject = `${params.senderName} shared a password with you on KeyNest`;

    const text = `Hello ${params.recipientName || 'there'},

${params.senderName} (${params.senderEmail}) has invited you to access a shared password for "${params.serviceName}" on KeyNest.

Access level: ${permissionLabel}

Accept your invitation using this secure, single-use link:
${acceptUrl}

This invitation link expires on ${formattedDate}.

SECURITY NOTICE:
For your protection, this email does NOT contain passwords, master keys, or account credentials. You must sign in or create an account using this invited email (${params.recipientEmail}) to accept access.

— The KeyNest Team`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
      <div style="background-color: #4f46e5; color: #ffffff; border-radius: 10px; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">
        KN
      </div>
      <span style="font-size: 18px; font-weight: bold; color: #0f172a; margin-left: 12px;">KeyNest</span>
    </div>

    <h2 style="font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 0; margin-bottom: 8px;">
      Password shared with you
    </h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.5; margin-top: 0; margin-bottom: 20px;">
      <strong>${params.senderName}</strong> (${params.senderEmail}) invited you to access login details for <strong>${params.serviceName}</strong>.
    </p>

    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">Access Level</div>
      <div style="font-size: 14px; font-weight: 600; color: #0f172a;">${permissionLabel}</div>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${acceptUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none;">
        Accept Invitation
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 16px;">
      This single-use invitation link expires on <strong>${formattedDate}</strong>.
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

    <p style="font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0;">
      <strong>Security Notice:</strong> KeyNest never includes passwords or private keys in email notifications. You must sign in or create an account with <strong>${params.recipientEmail}</strong> to accept access. If you did not expect this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;

    // Testing or In-Memory sink
    if (config.NODE_ENV === 'test' || config.EMAIL_PROVIDER === 'test') {
      const record: SentEmailRecord = {
        to: params.recipientEmail,
        from: config.RESEND_FROM_EMAIL,
        subject,
        text,
        html,
        inviteToken: params.inviteToken,
        sentAt: new Date().toISOString(),
      };
      this.sentEmails.push(record);
      logger.info(`[Test Email] Invitation sent to ${params.recipientEmail} for item ${params.serviceName}`);
      return { messageId: 'test_msg_' + Date.now() };
    }

    // Live Resend API delivery
    if (config.EMAIL_PROVIDER === 'resend' && config.RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: config.RESEND_FROM_EMAIL,
            to: [params.recipientEmail],
            subject,
            text,
            html,
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          logger.error('Resend email delivery failed:', errBody);
          throw new AppError(502, 'EMAIL_SEND_FAILED', 'Failed to dispatch email via email provider.');
        }

        const data = (await response.json()) as { id: string };
        logger.info(`Email invitation delivered via Resend: ${data.id}`);
        return { messageId: data.id };
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        logger.error('Unexpected error sending email:', err);
        throw new AppError(502, 'EMAIL_SEND_FAILED', 'Failed to send invitation email.');
      }
    }

    throw new AppError(
      503,
      'EMAIL_DELIVERY_NOT_CONFIGURED',
      'Email delivery is not configured on the server. Please set RESEND_API_KEY or SMTP credentials to send invitations.'
    );
  }

  static getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  static clearSentEmails(): void {
    this.sentEmails = [];
  }
}
