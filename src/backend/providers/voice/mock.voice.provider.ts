// src/backend/providers/voice/mock.voice.provider.ts

export interface VoiceParams {
  to: string;
  message: string;
  from?: string;
  voice?: 'man' | 'woman';
  language?: string;
}

export interface VoiceResult {
  success: boolean;
  callId?: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
  providerResponse: any;
}

export class MockVoiceProvider {
  name = 'mock-voice';

  async call(params: VoiceParams): Promise<VoiceResult> {
    console.log('📞 [MOCK] Voice call made:');
    console.log(`  To: ${params.to}`);
    console.log(`  Message: ${params.message}`);

    const success = Math.random() < 0.95;

    return {
      success,
      callId: success ? `mock_call_${Date.now()}` : undefined,
      status: success ? 'SENT' : 'FAILED',
      provider: 'mock-voice',
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