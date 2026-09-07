// src/backend/providers/email/resend.email.provider.ts

import { Resend } from 'resend';

export interface ResendEmailParams {
  to: string | string[];
  subject: string;
  content: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface ResendEmailResult {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
  providerResponse: any;
}

export class ResendEmailProvider {
  name = 'resend';
  private resend: Resend;
  private from: string;

  constructor(config: { apiKey: string; from?: string }) {
    this.resend = new Resend(config.apiKey);
    this.from = config.from || 'GORKA <noreply@gorka.com>';
  }

  async send(params: ResendEmailParams): Promise<ResendEmailResult> {
    try {
      const response = await this.resend.emails.send({
        from: params.from || this.from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.content,
        text: params.content,
        reply_to: params.replyTo,
        cc: params.cc,
        bcc: params.bcc,
      });

      if (response.error) {
        return {
          success: false,
          status: 'FAILED',
          provider: 'resend',
          error: response.error.message || 'Resend error',
          providerResponse: response.error
        };
      }

      return {
        success: true,
        messageId: response.data?.id,
        status: 'SENT',
        provider: 'resend',
        providerResponse: response
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'resend',
        error: error.message || 'Unknown error',
        providerResponse: error
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.send({
        to: 'igo2018fr@gmail.com',
        subject: 'Health Check',
        content: 'Resend health check',
        from: this.from
      });
      return result.success;
    } catch {
      return false;
    }
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    try {
      const testResend = new Resend(apiKey);
      const result = await testResend.emails.send({
        from: this.from,
        to: 'igo2018fr@gmail.com',
        subject: 'Credential Test',
        html: 'Testing Resend credentials'
      });
      return !result.error;
    } catch {
      return false;
    }
  }
}