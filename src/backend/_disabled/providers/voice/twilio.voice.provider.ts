// src/backend/providers/voice/twilio.voice.provider.ts

import twilio from 'twilio';

export interface TwilioVoiceConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  baseUrl?: string;
}

export interface CallParams {
  debtorPhone: string;
  agentPhone: string;
  message?: string;
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  status?: string;
  error?: string;
}

export class TwilioVoiceProvider {
  name = 'twilio-voice';
  private client: twilio.Twilio;
  private phoneNumber: string;
  private baseUrl: string;

  constructor(config: TwilioVoiceConfig) {
    this.client = twilio(config.accountSid, config.authToken);
    this.phoneNumber = config.phoneNumber;
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
  }

  async initiateCall(params: CallParams): Promise<CallResult> {
    try {
      const call = await this.client.calls.create({
        url: `${this.baseUrl}/api/communications/voice/twiml?debtor=${encodeURIComponent(params.debtorPhone)}`,
        to: params.agentPhone,
        from: this.phoneNumber,
        statusCallback: `${this.baseUrl}/api/communications/voice/status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCallStatus(callSid: string): Promise<any> {
    try {
      const call = await this.client.calls(callSid).fetch();
      return {
        sid: call.sid,
        status: call.status,
        duration: call.duration,
        from: call.from,
        to: call.to,
        startTime: call.startTime,
        endTime: call.endTime
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }

  healthCheck(): boolean {
    return true;
  }
}