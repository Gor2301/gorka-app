// src/backend/providers/mocean/mocean.sms.provider.ts

export interface MoceanConfig {
  token: string;
  from?: string;
}

export interface SmsParams {
  to: string;
  message: string;
  from?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';
  provider: string;
  error?: string;
  providerResponse: any;
}

export class MoceanSmsProvider {
  name = 'mocean';
  private token: string;
  private from: string;
  private baseUrl = 'https://rest.moceanapi.com/rest/2';

  constructor(config: MoceanConfig) {
    this.token = config.token;
    this.from = config.from || 'MOCEAN';
  }

  async send(params: SmsParams): Promise<SmsResult> {
    try {
      const response = await fetch(`${this.baseUrl}/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'mocean-from': params.from || this.from,
          'mocean-to': params.to,
          'mocean-text': params.message
        }).toString()
      });

      const text = await response.text();

      // Parse XML response
      const statusMatch = text.match(/<status>(\d+)<\/status>/);
      const msgidMatch = text.match(/<msgid>([^<]+)<\/msgid>/);
      const errMsgMatch = text.match(/<err_msg>([^<]+)<\/err_msg>/);

      const status = statusMatch ? statusMatch[1] : '1';
      const msgid = msgidMatch ? msgidMatch[1] : undefined;
      const errMsg = errMsgMatch ? errMsgMatch[1] : undefined;

      if (status === '0') {
        return {
          success: true,
          messageId: msgid,
          status: 'SENT',
          provider: 'mocean',
          providerResponse: text
        };
      } else {
        return {
          success: false,
          status: 'FAILED',
          provider: 'mocean',
          error: errMsg || 'Unknown error',
          providerResponse: text
        };
      }
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'mocean',
        error: error.message || 'Unknown error',
        providerResponse: error
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'mocean-from': this.from,
          'mocean-to': '639999999999',
          'mocean-text': 'ping'
        }).toString()
      });

      return response.status === 200;
    } catch {
      return false;
    }
  }

  async validateCredentials(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'mocean-from': 'TEST',
          'mocean-to': '639999999999',
          'mocean-text': 'test'
        }).toString()
      });

      return response.status === 200;
    } catch {
      return false;
    }
  }
}