import { DebtorContext, AiRecommendation } from '../types/ai.types'

export class RulesService {
  generateRecommendation(context: DebtorContext): AiRecommendation {
    const { debtor, indicators, contactAttempts } = context
    
    if (debtor.daysOverdue > 60 && indicators.paymentReliability === 'POOR') {
      return {
        channel: 'EMAIL',
        priority: 'HIGH',
        tone: 'URGENT',
        timing: 'WITHIN_24_HOURS',
        rationale: 'Debtor is severely overdue with poor payment history. Immediate firm action required.'
      }
    }

    if (debtor.daysOverdue > 30 && contactAttempts.responseRate < 0.2) {
      return {
        channel: 'EMAIL',
        priority: 'HIGH',
        tone: 'FIRM',
        timing: 'WITHIN_24_HOURS',
        rationale: 'Debtor has not responded to previous attempts. A firm email is needed to prompt action.'
      }
    }

    if (debtor.daysOverdue > 15) {
      const channel = indicators.communicationPreference !== 'UNKNOWN' 
        ? indicators.communicationPreference 
        : 'EMAIL'
      
      return {
        channel: channel,
        priority: 'MEDIUM',
        tone: 'PROFESSIONAL',
        timing: 'WITHIN_48_HOURS',
        rationale: `Standard follow-up based on ${debtor.daysOverdue} days overdue. Using preferred channel: ${channel}.`
      }
    }

    if (debtor.daysOverdue > 0) {
      return {
        channel: 'EMAIL',
        priority: 'LOW',
        tone: 'FRIENDLY',
        timing: 'WITHIN_48_HOURS',
        rationale: 'Early stage reminder. Friendly approach to maintain good relationship.'
      }
    }

    return {
      channel: 'EMAIL',
      priority: 'MEDIUM',
      tone: 'PROFESSIONAL',
      timing: 'WITHIN_48_HOURS',
      rationale: 'Standard recommendation based on available debtor data.'
    }
  }
}