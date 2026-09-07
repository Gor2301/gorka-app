import { Resend } from 'resend';

export interface EmailParams {
  to: string | string[];
  subject: string;
  content: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
}

export class EmailService {
  private resend: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ RESEND_API_KEY not set in environment variables');
    }
    this.resend = new Resend(apiKey || '');
    this.from = process.env.FROM_EMAIL || 'GORKA <onboarding@resend.dev>';
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      const { to, subject, content, from, replyTo, cc, bcc } = params;

      const response = await this.resend.emails.send({
        from: from || this.from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: content,
        text: content,
        reply_to: replyTo,
        cc: cc,
        bcc: bcc,
      });

      return {
        success: true,
        messageId: response.data?.id || 'unknown',
        status: 'SENT',
        provider: 'resend',
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'resend',
        error: error.message || 'Failed to send email',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: 'test@example.com',
        subject: 'Health Check',
        html: '<p>Health check</p>',
      });
      return true;
    } catch {
      return false;
    }
  }
}