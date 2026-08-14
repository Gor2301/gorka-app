import { MoceanSmsProvider } from './mocean/mocean.sms.provider';
import { ResendEmailProvider } from './email/resend.email.provider';
import { MockEmailProvider } from './email/mock.email.provider';
import { MockPushProvider } from './push/mock.push.provider';
import { MockVoiceProvider } from './voice/mock.voice.provider';
import { TwilioVoiceProvider } from './voice/twilio.voice.provider';

export interface ProviderConfig {
  provider: string;
  credentials?: Record<string, any>;
}

export class ProviderFactory {
  private registry: any;

  constructor() {
    // Empty constructor — registry is managed separately
  }

  async createSmsProvider(config: ProviderConfig): Promise<any> {
    if (config.provider === 'mocean') {
      return new MoceanSmsProvider({
        token: config.credentials?.token || process.env.MOCEAN_TOKEN,
        from: config.credentials?.from || 'MOCEAN'
      });
    }
    throw new Error(`Unsupported SMS provider: ${config.provider}`);
  }

  createEmailProvider(config: ProviderConfig): any {
    if (config.provider === 'resend') {
      return new ResendEmailProvider({
        apiKey: config.credentials?.apiKey || process.env.RESEND_API_KEY,
        from: config.credentials?.from || process.env.FROM_EMAIL || 'GORKA <onboarding@resend.dev>'
      });
    }
    if (config.provider === 'mock') {
      return new MockEmailProvider();
    }
    throw new Error(`Unsupported email provider: ${config.provider}`);
  }

  createPushProvider(config: ProviderConfig): any {
    if (config.provider === 'mock') {
      return new MockPushProvider();
    }
    throw new Error(`Unsupported push provider: ${config.provider}`);
  }

  createVoiceProvider(config: ProviderConfig): any {
    if (config.provider === 'mock') {
      return new MockVoiceProvider();
    }
    if (config.provider === 'twilio') {
      return new TwilioVoiceProvider({
        accountSid: config.credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID,
        authToken: config.credentials?.authToken || process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: config.credentials?.phoneNumber || process.env.TWILIO_PHONE_NUMBER,
        baseUrl: config.credentials?.baseUrl || process.env.BASE_URL || 'http://localhost:3000'
      });
    }
    throw new Error(`Unsupported voice provider: ${config.provider}`);
  }
}