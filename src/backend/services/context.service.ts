import { PrismaClient } from '@prisma/client'
import { DebtorContext, CommunicationEvent, PaymentEvent, ContactMetrics, BehavioralIndicators } from '../types/ai.types'

const prisma = new PrismaClient()

export class ContextService {
  async buildContext(debtorId: string, organizationId: string): Promise<DebtorContext> {
    const debtor = await prisma.debtor.findFirst({
      where: {
        id: debtorId,
        organizationId: organizationId
      },
      include: {
        messageLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        actions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    })

    if (!debtor) {
      throw new Error('Debtor not found or access denied')
    }

    // Build communication history from messageLogs
    const communicationHistory = this.buildCommunicationHistory(debtor.messageLogs || [])
    const paymentHistory = this.buildPaymentHistory(debtor.actions || [])
    const contactMetrics = this.calculateContactMetrics(debtor.messageLogs || [])
    const indicators = this.determineIndicators(debtor, contactMetrics, paymentHistory)

    // Calculate debt amount from metadata or use 0
    const debtAmount = debtor.metadata && typeof debtor.metadata === 'object' 
      ? (debtor.metadata as any)?.amount || (debtor.metadata as any)?.debtAmount || 0 
      : 0

    return {
      debtor: {
        id: debtor.id,
        name: debtor.name || 'Unknown',
        email: debtor.email || '',
        phone: debtor.phone || '',
        debtAmount: typeof debtAmount === 'number' ? debtAmount : 0,
        daysOverdue: this.calculateDaysOverdue(debtor.createdAt),
        debtOrigin: 'Unknown'
      },
      communicationHistory,
      paymentHistory,
      contactAttempts: contactMetrics,
      indicators
    }
  }

  private buildCommunicationHistory(messageLogs: any[]): CommunicationEvent[] {
    return messageLogs.map(msg => ({
      date: msg.createdAt,
      channel: msg.channel as 'EMAIL' | 'SMS' | 'VOICE' | 'PUSH',
      direction: 'OUTBOUND' as 'OUTBOUND' | 'INBOUND',
      subject: msg.subject || undefined,
      response: msg.status === 'DELIVERED' || msg.status === 'READ'
    }))
  }

  private buildPaymentHistory(actions: any[]): PaymentEvent[] {
    const payments: PaymentEvent[] = []
    
    actions.forEach(action => {
      if (action.type === 'PAYMENT' || action.type === 'PARTIAL_PAYMENT') {
        const metadata = action.metadata && typeof action.metadata === 'object' ? action.metadata as any : {}
        payments.push({
          date: action.createdAt,
          amount: metadata.amount || 0,
          status: action.type === 'PAYMENT' ? 'FULL' : 'PARTIAL'
        })
      }
      
      if (action.type === 'PROMISE') {
        const metadata = action.metadata && typeof action.metadata === 'object' ? action.metadata as any : {}
        payments.push({
          date: action.createdAt,
          amount: metadata.promisedAmount || 0,
          status: 'PROMISED'
        })
      }
    })

    return payments
  }

  private calculateContactMetrics(messageLogs: any[]): ContactMetrics {
    const total = messageLogs.length
    const emailAttempts = messageLogs.filter(m => m.channel === 'EMAIL').length
    const smsAttempts = messageLogs.filter(m => m.channel === 'SMS').length
    const voiceAttempts = messageLogs.filter(m => m.channel === 'VOICE').length
    const responses = messageLogs.filter(m => m.status === 'DELIVERED' || m.status === 'READ').length

    return {
      total,
      emailAttempts,
      smsAttempts,
      voiceAttempts,
      responseRate: total > 0 ? responses / total : 0
    }
  }

  private determineIndicators(debtor: any, metrics: ContactMetrics, payments: PaymentEvent[]): BehavioralIndicators {
    const paymentReliability = this.determinePaymentReliability(payments)
    const engagementLevel = this.determineEngagementLevel(metrics)
    const commPreference = this.determineCommPreference(metrics)
    const previousPromises = payments.filter(p => p.status === 'PROMISED').length
    const promisesKept = payments.filter(p => p.status === 'PARTIAL' || p.status === 'FULL').length

    return {
      paymentReliability,
      engagementLevel,
      communicationPreference: commPreference,
      previousPromises,
      promisesKept
    }
  }

  private determinePaymentReliability(payments: PaymentEvent[]): 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN' {
    if (payments.length === 0) return 'UNKNOWN'
    const fullPayments = payments.filter(p => p.status === 'FULL').length
    const ratio = fullPayments / payments.length
    if (ratio > 0.7) return 'GOOD'
    if (ratio > 0.4) return 'FAIR'
    return 'POOR'
  }

  private determineEngagementLevel(metrics: ContactMetrics): 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' {
    if (metrics.total === 0) return 'UNKNOWN'
    if (metrics.responseRate > 0.5) return 'HIGH'
    if (metrics.responseRate > 0.2) return 'MEDIUM'
    return 'LOW'
  }

  private determineCommPreference(metrics: ContactMetrics): 'EMAIL' | 'SMS' | 'VOICE' | 'UNKNOWN' {
    const counts = { EMAIL: metrics.emailAttempts, SMS: metrics.smsAttempts, VOICE: metrics.voiceAttempts }
    const max = Math.max(counts.EMAIL, counts.SMS, counts.VOICE)
    if (max === 0) return 'UNKNOWN'
    if (counts.EMAIL === max) return 'EMAIL'
    if (counts.SMS === max) return 'SMS'
    return 'VOICE'
  }

  private calculateDaysOverdue(createdAt: Date): number {
    const now = new Date()
    const diffTime = now.getTime() - createdAt.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }
}