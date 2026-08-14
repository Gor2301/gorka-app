// src/backend/services/push.service.ts

import { ProviderFactory } from '../providers/provider.factory';

export interface SendPushParams {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: number;
  sound?: string;
  data?: any;
}

export interface SendPushResult {
  success: boolean;
  messageId?: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
}

export class PushService {
  private providerFactory: ProviderFactory;

  constructor() {
    this.providerFactory = new ProviderFactory();
  }

  async sendPush(params: SendPushParams): Promise<SendPushResult> {
    try {
      const provider = this.providerFactory.createPush('mock', {});

      const result = await provider.send({
        userId: params.userId,
        title: params.title,
        body: params.body,
        icon: params.icon,
        badge: params.badge,
        sound: params.sound,
        data: params.data
      });

      return {
        success: result.success,
        messageId: result.messageId,
        status: result.status,
        provider: result.provider,
        error: result.error
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'mock-push',
        error: error.message || 'Unknown error'
      };
    }
  }
}