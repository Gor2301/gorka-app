// src/backend/providers/provider.registry.ts

import { MoceanSmsProvider } from './mocean/mocean.sms.provider';
import { MockEmailProvider } from './email/mock.email.provider';
import { ResendEmailProvider } from './email/resend.email.provider';
import { MockPushProvider } from './push/mock.push.provider';
import { MockVoiceProvider } from './voice/mock.voice.provider';
import { TwilioVoiceProvider } from './voice/twilio.voice.provider';

export class ProviderRegistry {
  private smsProviders: Map<string, (config: any) => any> = new Map();
  private emailProviders: Map<string, (config: any) => any> = new Map();
  private pushProviders: Map<string, (config: any) => any> = new Map();
  private voiceProviders: Map<string, (config: any) => any> = new Map();

  constructor() {
    // Register SMS providers
    this.registerSms('mocean', (config) => new MoceanSmsProvider(config));

    // Register Email providers
    this.registerEmail('mock', (config) => new MockEmailProvider());
    this.registerEmail('resend', (config) => new ResendEmailProvider(config));

    // Register Push providers
    this.registerPush('mock', (config) => new MockPushProvider());

    // Register Voice providers
    this.registerVoice('mock', (config) => new MockVoiceProvider());
    this.registerVoice('twilio', (config) => new TwilioVoiceProvider(config));
  }

  // ==================== SMS ====================
  registerSms(name: string, factory: (config: any) => any) {
    this.smsProviders.set(name, factory);
  }

  createSms(name: string, config: any) {
    const factory = this.smsProviders.get(name);
    if (!factory) {
      throw new Error(`SMS provider "${name}" not registered`);
    }
    return factory(config);
  }

  getSmsProviders(): string[] {
    return Array.from(this.smsProviders.keys());
  }

  // ==================== Email ====================
  registerEmail(name: string, factory: (config: any) => any) {
    this.emailProviders.set(name, factory);
  }

  createEmail(name: string, config: any) {
    const factory = this.emailProviders.get(name);
    if (!factory) {
      throw new Error(`Email provider "${name}" not registered`);
    }
    return factory(config);
  }

  getEmailProviders(): string[] {
    return Array.from(this.emailProviders.keys());
  }

  // ==================== Push ====================
  registerPush(name: string, factory: (config: any) => any) {
    this.pushProviders.set(name, factory);
  }

  createPush(name: string, config: any) {
    const factory = this.pushProviders.get(name);
    if (!factory) {
      throw new Error(`Push provider "${name}" not registered`);
    }
    return factory(config);
  }

  getPushProviders(): string[] {
    return Array.from(this.pushProviders.keys());
  }

  // ==================== Voice ====================
  registerVoice(name: string, factory: (config: any) => any) {
    this.voiceProviders.set(name, factory);
  }

  createVoice(name: string, config: any) {
    const factory = this.voiceProviders.get(name);
    if (!factory) {
      throw new Error(`Voice provider "${name}" not registered`);
    }
    return factory(config);
  }

  getVoiceProviders(): string[] {
    return Array.from(this.voiceProviders.keys());
  }
}