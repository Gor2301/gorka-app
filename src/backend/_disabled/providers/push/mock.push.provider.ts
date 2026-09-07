// src/backend/providers/push/mock.push.provider.ts

export interface PushParams {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: number;
  sound?: string;
  data?: any;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
  providerResponse: any;
}

export class MockPushProvider {
  name = 'mock-push';

  async send(params: PushParams): Promise<PushResult> {
    console.log('🔔 [MOCK] Push notification sent:');
    console.log(`  To: ${params.userId}`);
    console.log(`  Title: ${params.title}`);
    console.log(`  Body: ${params.body}`);

    const success = Math.random() < 0.95;

    return {
      success,
      messageId: success ? `mock_push_${Date.now()}` : undefined,
      status: success ? 'SENT' : 'FAILED',
      provider: 'mock-push',
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