import { GoogleGenerativeAI } from '@google/generative-ai'
import { DebtorContext, AiAnalysisResult, AiRecommendation, EmailDraft } from '../types/ai.types'

export class GeminiService {
  private model: any
  private modelName: string

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set in environment')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
   this.modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    this.model = genAI.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    })
  }

  async generateStrategy(context: DebtorContext): Promise<AiAnalysisResult> {
    const startTime = Date.now()
    
    try {
      const prompt = this.buildPrompt(context)
      const result = await this.model.generateContent(prompt)
      const responseText = result.response.text()
      
      const parsed = this.parseResponse(responseText)
      
      return {
        recommendation: parsed.recommendation,
        emailDraft: parsed.emailDraft,
        riskFlags: parsed.riskFlags || [],
        metadata: {
          modelVersion: this.modelName,
          promptVersion: '1.0.0',
          analysisTimestamp: new Date().toISOString(),
          responseTimeMs: Date.now() - startTime
        }
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      throw error
    }
  }

  private buildPrompt(context: DebtorContext): string {
    return `
You are an expert debt collection assistant. Analyze the debtor data and provide structured recommendations.

## Debtor Information
- Name: ${context.debtor.name}
- Debt Amount: $${context.debtor.debtAmount}
- Days Overdue: ${context.debtor.daysOverdue}
- Debt Origin: ${context.debtor.debtOrigin}

## Contact History
- Total Attempts: ${context.contactAttempts.total}
- Email Attempts: ${context.contactAttempts.emailAttempts}
- SMS Attempts: ${context.contactAttempts.smsAttempts}
- Voice Attempts: ${context.contactAttempts.voiceAttempts}
- Response Rate: ${(context.contactAttempts.responseRate * 100).toFixed(0)}%

## Behavioral Indicators
- Payment Reliability: ${context.indicators.paymentReliability}
- Engagement Level: ${context.indicators.engagementLevel}
- Communication Preference: ${context.indicators.communicationPreference}
- Previous Promises: ${context.indicators.previousPromises}
- Promises Kept: ${context.indicators.promisesKept}

## Recent Communication History
${context.communicationHistory.slice(0, 5).map(c => 
  `- ${c.date.toLocaleDateString()}: ${c.channel} ${c.direction}${c.response ? ' (responded)' : ' (no response)'}`
).join('\n')}

## Task
Provide a structured recommendation in JSON format with the following fields:
{
  "recommendation": {
    "channel": "EMAIL" | "SMS" | "VOICE" | "PUSH",
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "tone": "FRIENDLY" | "FIRM" | "URGENT" | "PROFESSIONAL",
    "timing": "WITHIN_24_HOURS" | "WITHIN_48_HOURS" | "NEXT_WEEK" | "IMMEDIATE",
    "rationale": "brief explanation of why this recommendation"
  },
  "emailDraft": {
    "subject": "subject line for the email",
    "body": "full email body text"
  },
  "riskFlags": ["list of any risk indicators"]
}

Important rules:
1. The email must be professional and compliant
2. Include the exact debt amount and days overdue
3. Never threaten legal action
4. Always include contact information
5. Be firm but respectful

Return ONLY valid JSON, no other text.
`
  }

  private parseResponse(text: string): { recommendation: AiRecommendation; emailDraft: EmailDraft; riskFlags: string[] } {
    try {
      let jsonStr = text
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      
      const parsed = JSON.parse(jsonStr)
      
      return {
        recommendation: parsed.recommendation,
        emailDraft: {
          subject: parsed.emailDraft.subject,
          body: parsed.emailDraft.body,
          isValid: true
        },
        riskFlags: parsed.riskFlags || []
      }
    } catch (error) {
      console.error('Failed to parse Gemini response:', text)
      return this.getFallbackResponse()
    }
  }

  private getFallbackResponse(): { recommendation: AiRecommendation; emailDraft: EmailDraft; riskFlags: string[] } {
    return {
      recommendation: {
        channel: 'EMAIL',
        priority: 'MEDIUM',
        tone: 'PROFESSIONAL',
        timing: 'WITHIN_48_HOURS',
        rationale: 'Standard follow-up based on collection best practices.'
      },
      emailDraft: {
        subject: 'Follow-up on your account',
        body: 'Dear Customer,\n\nThis is a follow-up regarding your account. Please contact us to discuss payment options.\n\nThank you for your attention to this matter.',
        isValid: true
      },
      riskFlags: ['PARSING_ERROR']
    }
  }
}