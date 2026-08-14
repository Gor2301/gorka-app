// src/backend/providers/email/mock.email.provider.ts

export interface EmailParams {
  to: string | string[];
  subject: string;
  content: string | { html: string; text: string };
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
  providerResponse: any;
}

export class MockEmailProvider {
  name = 'mock-email';

  async send(params: EmailParams): Promise<EmailResult> {
    console.log('📧 [MOCK] Email sent:');
    console.log(`  To: ${params.to}`);
    console.log(`  Subject: ${params.subject}`);
    console.log(`  Content: ${typeof params.content === 'string' ? params.content.substring(0, 100) : 'HTML content'}`);

    const success = Math.random() < 0.95;

    return {
      success,
      messageId: success ? `mock_email_${Date.now()}` : undefined,
      status: success ? 'SENT' : 'FAILED',
      provider: 'mock-email',
      error: success ? undefined : 'Mock failure (simulated)',
      providerResponse: { success, mock: true }
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async validateCredentials(credentials: any): Promise<boolean> {
    return true;
  }
}