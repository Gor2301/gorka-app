// Context Types
export interface DebtorContext {
  debtor: {
    id: string
    name: string
    email: string
    phone: string
    debtAmount: number
    daysOverdue: number
    debtOrigin: string
  }
  communicationHistory: CommunicationEvent[]
  paymentHistory: PaymentEvent[]
  contactAttempts: ContactMetrics
  indicators: BehavioralIndicators
}

export interface CommunicationEvent {
  date: Date
  channel: 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH'
  direction: 'OUTBOUND' | 'INBOUND'
  subject?: string
  response: boolean
}

export interface PaymentEvent {
  date: Date
  amount: number
  status: 'FULL' | 'PARTIAL' | 'PROMISED' | 'FAILED'
}

export interface ContactMetrics {
  total: number
  emailAttempts: number
  smsAttempts: number
  voiceAttempts: number
  responseRate: number
}

export interface BehavioralIndicators {
  paymentReliability: 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN'
  engagementLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  communicationPreference: 'EMAIL' | 'SMS' | 'VOICE' | 'UNKNOWN'
  previousPromises: number
  promisesKept: number
}

// AI Response Types
export interface AiRecommendation {
  channel: 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  tone: 'FRIENDLY' | 'FIRM' | 'URGENT' | 'PROFESSIONAL'
  timing: 'WITHIN_24_HOURS' | 'WITHIN_48_HOURS' | 'NEXT_WEEK' | 'IMMEDIATE'
  rationale: string
}

export interface EmailDraft {
  subject: string
  body: string
  isValid: boolean
  validationErrors?: string[]
}

export interface AiAnalysisResult {
  recommendation: AiRecommendation
  emailDraft: EmailDraft
  riskFlags: string[]
  metadata: {
    modelVersion: string
    promptVersion: string
    analysisTimestamp: string
    responseTimeMs: number
  }
}

// Outcome Types
export type OutcomeStatus = 
  | 'PAID' 
  | 'PARTIAL_PAID' 
  | 'PROMISED' 
  | 'NO_RESPONSE' 
  | 'REFUSED' 
  | 'CONTACTED'

export interface OutcomeRecord {
  debtorId: string
  recommendationId?: string
  outcomeStatus: OutcomeStatus
  amount?: number
  promiseDate?: Date
  agentNotes?: string
  agentRating?: number
}

// Request/Response Types
export interface AnalyzeRequest {
  debtorId: string
}

export interface AnalyzeResponse {
  success: boolean
  data?: AiAnalysisResult
  error?: string
}

export interface OutcomeRequest {
  debtorId: string
  recommendationId?: string
  outcome: {
    status: OutcomeStatus
    amount?: number
    promiseDate?: string
    agentNotes?: string
    rating?: number
  }
}

export interface DraftRequest {
  debtorId: string
  tone?: 'FRIENDLY' | 'FIRM' | 'URGENT' | 'PROFESSIONAL'
  customInstructions?: string
}