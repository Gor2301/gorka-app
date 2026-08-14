// src/types/communication.types.ts

export type Channel = 'email' | 'sms' | 'whatsapp';

export type MessageStatus = 
  | 'PENDING' 
  | 'QUEUED' 
  | 'SENT' 
  | 'DELIVERED' 
  | 'OPENED' 
  | 'CLICKED' 
  | 'FAILED' 
  | 'BOUNCED' 
  | 'COMPLAINT';

export type MessageEventType = 
  | 'queued' 
  | 'sent' 
  | 'delivered' 
  | 'opened' 
  | 'clicked' 
  | 'hard_bounce' 
  | 'soft_bounce' 
  | 'complaint' 
  | 'failed' 
  | 'retry';

export interface SendMessageOptions {
  channel: Channel;
  recipient: string;
  templateName: string;
  debtorId: string;
  userId?: string;
  context?: Record<string, any>;
  scheduledAt?: Date;
  priority?: 'low' | 'medium' | 'high';
}

export interface SendMessageResult {
  success: boolean;
  messageLogId: string;
  providerMessageId?: string;
  error?: string;
  scheduled?: boolean;
}

export interface ChannelCapabilities {
  supportsScheduling: boolean;
  supportsAttachments: boolean;
  supportsTracking: boolean;
  supportsTemplates: boolean;
  maxMessageSize: number;
  supportedContentTypes: ('html' | 'plain' | 'markdown')[];
  rateLimits?: {
    perMinute?: number;
    perHour?: number;
    perDay?: number;
  };
}

export interface RenderTemplateOptions {
  templateName: string;
  channel: Channel;
  debtorId: string;
  context?: Record<string, any>;
}

export interface RenderedContent {
  subject: string;
  html: string;
  text: string;
  metadata: Record<string, any>;
}