// src/backend/services/communication.service.ts

import { ProviderFactory, ProviderConfig } from '../providers/provider.factory';

export interface SendSmsParams {
  to: string;
  message: string;
  from?: string;
  organizationId?: string;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
  provider: string;
  error?: string;
}

export class CommunicationService {
  private providerFactory: ProviderFactory;

  constructor() {
    this.providerFactory = new ProviderFactory();
  }

  /**
   * Send an SMS message
   */
  async sendSms(params: SendSmsParams): Promise<SendSmsResult> {
    try {
      // Prepare provider configuration
      const config: ProviderConfig = {
        provider: 'mocean',
        credentials: {
          token: process.env.MOCEAN_TOKEN || 'apit-2XC9bQdPtHfdnfsil7jgsTLz6N3qPSpI-DQFEw',
          from: params.from || 'MOCEAN'
        }
      };

      // Get the SMS provider
      const provider = await this.providerFactory.createSmsProvider(config);

      // Send the message
      const result = await provider.send({
        to: params.to,
        message: params.message,
        from: params.from
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
        provider: 'mocean',
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Send an SMS with retry logic
   */
  async sendSmsWithRetry(
    params: SendSmsParams,
    maxRetries: number = 3
  ): Promise<SendSmsResult> {
    let lastError: string | undefined;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      console.log(`📤 SMS attempt ${attempt}/${maxRetries} to ${params.to}`);

      const result = await this.sendSms(params);

      if (result.success) {
        console.log(`✅ SMS sent successfully on attempt ${attempt}`);
        return result;
      }

      lastError = result.error;
      console.log(`❌ Attempt ${attempt} failed: ${lastError}`);

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      status: 'FAILED',
      provider: 'mocean',
      error: `Failed after ${maxRetries} attempts: ${lastError || 'Unknown error'}`
    };
  }

  /**
   * Health check for the communication service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const config: ProviderConfig = {
        provider: 'mocean',
        credentials: {
          token: process.env.MOCEAN_TOKEN || 'apit-2XC9bQdPtHfdnfsil7jgsTLz6N3qPSpI-DQFEw'
        }
      };

      const provider = await this.providerFactory.createSmsProvider(config);
      return await provider.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Helper: Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}