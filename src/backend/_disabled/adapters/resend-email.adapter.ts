import { Resend } from 'resend';
import { logger } from '../config/logger';

export interface ChannelAdapter {
  send(params: any): Promise<any>;
}

export class ResendEmailAdapter implements ChannelAdapter {
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }
    this.resend = new Resend(apiKey);
  }

  async send(params: { to: string; subject: string; content: string; from?: string }): Promise<any> {
    try {
      const result = await this.resend.emails.send({
        from: params.from || process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: params.to,
        subject: params.subject,
        html: params.content,
      });

      logger.info(`📧 Email sent to ${params.to}`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to send email to ${params.to}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const emailAdapter = new ResendEmailAdapter();

// Default export
export default emailAdapter;