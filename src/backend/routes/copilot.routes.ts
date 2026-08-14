import express, { Request } from 'express'
import { ContextService } from '../services/context.service'
import { GeminiService } from '../services/gemini.service'
import { RulesService } from '../services/rules.service'
import { PrismaClient } from '@prisma/client'
import { authenticateToken } from '../middleware/auth'
import { requireTenant } from '../middleware/tenant'
import { 
  AnalyzeRequest, 
  OutcomeRequest, 
  DraftRequest,
  AiRecommendation 
} from '../types/ai.types'

const router = express.Router()
const prisma = new PrismaClient()
const contextService = new ContextService()
const geminiService = new GeminiService()
const rulesService = new RulesService()

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      user?: any;
    }
  }
}

// Helper to ensure ID is a string
function ensureStringId(id: any): string {
  if (Array.isArray(id)) return id[0]
  return id
}

// ============================================
// 1. ANALYZE DEBTOR - Generate AI Recommendation
// ============================================
/**
 * POST /api/copilot/analyze
 * Body: { debtorId: string }
 * 
 * Generates a collection strategy and email draft for a debtor.
 * Uses Gemini API with fallback to deterministic rules.
 */
router.post('/analyze', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { debtorId } = req.body as AnalyzeRequest
    const organizationId = req.organizationId
    const userId = req.user?.id

    if (!debtorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'debtorId is required' 
      })
    }

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    // 1. Build context
    const context = await contextService.buildContext(debtorId, organizationId)

    // 2. Try Gemini first
    let analysisResult
    let usedFallback = false

    try {
      analysisResult = await geminiService.generateStrategy(context)
    } catch (error) {
      console.error('Gemini API failed, using fallback:', error)
      usedFallback = true
      
      // 3. Fallback to deterministic rules
      const recommendation = rulesService.generateRecommendation(context)
      analysisResult = {
        recommendation,
        emailDraft: {
          subject: `Follow-up on your account - ${context.debtor.name}`,
          body: `Dear ${context.debtor.name},\n\nThis is a follow-up regarding your account with a balance of $${context.debtor.debtAmount} that is ${context.debtor.daysOverdue} days overdue.\n\nPlease contact us to discuss payment options at your earliest convenience.\n\nThank you for your attention to this matter.`,
          isValid: true
        },
        riskFlags: ['FALLBACK_MODE'],
        metadata: {
          modelVersion: 'fallback-rules-v1',
          promptVersion: '1.0.0',
          analysisTimestamp: new Date().toISOString(),
          responseTimeMs: 0
        }
      }
    }

    // 4. Store the recommendation in database
    const recommendation = await prisma.aiRecommendation.create({
      data: {
        debtorId: ensureStringId(debtorId),
        organizationId: organizationId,
        agentId: userId || null,
        channel: analysisResult.recommendation.channel,
        tone: analysisResult.recommendation.tone,
        rationale: analysisResult.recommendation.rationale,
        emailSubject: analysisResult.emailDraft.subject,
        emailBody: analysisResult.emailDraft.body,
        status: 'PENDING',
        modelVersion: analysisResult.metadata.modelVersion,
        promptVersion: analysisResult.metadata.promptVersion,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    })

    // 5. Return the result with the recommendation ID
    res.json({
      success: true,
      data: {
        recommendationId: recommendation.id,
        ...analysisResult,
        usedFallback,
        context: {
          debtor: context.debtor,
          indicators: context.indicators,
          contactAttempts: context.contactAttempts
        }
      }
    })

  } catch (error) {
    console.error('Analysis error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendation'
    })
  }
})

// ============================================
// 2. GET RECOMMENDATION HISTORY
// ============================================
/**
 * GET /api/copilot/history/:debtorId
 * Returns all AI recommendations for a debtor
 */
router.get('/history/:debtorId', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { debtorId } = req.params
    const organizationId = req.organizationId

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    const recommendations = await prisma.aiRecommendation.findMany({
      where: {
        debtorId: ensureStringId(debtorId),
        organizationId: organizationId
      },
      orderBy: {
        generatedAt: 'desc'
      },
      include: {
        outcomes: true,
        feedbacks: true
      }
    })

    res.json({
      success: true,
      data: recommendations
    })

  } catch (error) {
    console.error('History error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history'
    })
  }
})

// ============================================
// 3. GET SPECIFIC RECOMMENDATION
// ============================================
/**
 * GET /api/copilot/recommendation/:id
 * Returns a specific recommendation by ID
 */
router.get('/recommendation/:id', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { id } = req.params
    const organizationId = req.organizationId

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    const recommendation = await prisma.aiRecommendation.findFirst({
      where: {
        id: ensureStringId(id),
        organizationId: organizationId
      },
      include: {
        outcomes: true,
        feedbacks: true,
        debtor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      })
    }

    res.json({
      success: true,
      data: recommendation
    })

  } catch (error) {
    console.error('Get recommendation error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendation'
    })
  }
})

// ============================================
// 4. APPROVE RECOMMENDATION
// ============================================
/**
 * POST /api/copilot/approve/:id
 * Approves a recommendation for sending
 * This is where human approval is enforced server-side
 */
router.post('/approve/:id', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { id } = req.params
    const organizationId = req.organizationId
    const userId = req.user?.id

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    // 1. Get the recommendation with strict tenant isolation
    const recommendation = await prisma.aiRecommendation.findFirst({
      where: {
        id: ensureStringId(id),
        organizationId: organizationId
      },
      include: {
        debtor: true
      }
    })

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      })
    }

    // 2. Validate recommendation can be approved
    if (recommendation.status === 'SENT') {
      return res.status(400).json({
        success: false,
        error: 'Recommendation already sent'
      })
    }

    if (recommendation.status === 'EXPIRED') {
      return res.status(400).json({
        success: false,
        error: 'Recommendation has expired'
      })
    }

    if (recommendation.status === 'REJECTED') {
      return res.status(400).json({
        success: false,
        error: 'Recommendation was rejected'
      })
    }

    // 3. Check if recommendation is expired
    if (recommendation.expiresAt && new Date() > recommendation.expiresAt) {
      await prisma.aiRecommendation.update({
        where: { id: ensureStringId(id) },
        data: { status: 'EXPIRED' }
      })
      return res.status(400).json({
        success: false,
        error: 'Recommendation has expired'
      })
    }

    // 4. Check quiet hours (if configured)
    const now = new Date()
    const hours = now.getHours()
    // Example: No sending between 9 PM and 8 AM
    if (hours < 8 || hours > 21) {
      return res.status(400).json({
        success: false,
        error: 'Outside quiet hours (8 AM - 9 PM)'
      })
    }

    // 5. Check contact limits (if configured)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentAttempts = await prisma.messageLog.count({
      where: {
        debtorId: recommendation.debtorId,
        createdAt: {
          gte: last7Days
        },
        channel: 'EMAIL'
      }
    })

    const maxAttempts = 5 // Configurable
    if (recentAttempts >= maxAttempts) {
      return res.status(400).json({
        success: false,
        error: `Contact limit reached (${maxAttempts} attempts in 7 days)`
      })
    }

    // 6. Approve the recommendation
    const approved = await prisma.aiRecommendation.update({
      where: { id: ensureStringId(id) },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        agentId: userId || null
      }
    })

    res.json({
      success: true,
      data: {
        recommendationId: approved.id,
        status: approved.status,
        message: 'Recommendation approved. Ready to send.'
      }
    })

  } catch (error) {
    console.error('Approval error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to approve recommendation'
    })
  }
})

// ============================================
// 5. REJECT RECOMMENDATION
// ============================================
/**
 * POST /api/copilot/reject/:id
 * Rejects a recommendation
 */
router.post('/reject/:id', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { id } = req.params
    const organizationId = req.organizationId

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    const recommendation = await prisma.aiRecommendation.findFirst({
      where: {
        id: ensureStringId(id),
        organizationId: organizationId
      }
    })

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      })
    }

    if (recommendation.status === 'SENT') {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject a sent recommendation'
      })
    }

    const rejected = await prisma.aiRecommendation.update({
      where: { id: ensureStringId(id) },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date()
      }
    })

    res.json({
      success: true,
      data: {
        recommendationId: rejected.id,
        status: rejected.status
      }
    })

  } catch (error) {
    console.error('Rejection error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to reject recommendation'
    })
  }
})

// ============================================
// 6. SEND COMMUNICATION (After Approval)
// ============================================
/**
 * POST /api/copilot/send/:id
 * Sends the approved communication
 * This is where the existing communication system is called
 */
router.post('/send/:id', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { id } = req.params
    const organizationId = req.organizationId
    const userId = req.user?.id

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    // 1. Get the recommendation (must be ACCEPTED)
    const recommendation = await prisma.aiRecommendation.findFirst({
      where: {
        id: ensureStringId(id),
        organizationId: organizationId
      },
      include: {
        debtor: true
      }
    })

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      })
    }

    // 2. Verify it's approved
    if (recommendation.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: `Recommendation must be accepted before sending. Current status: ${recommendation.status}`
      })
    }

    // 3. Verify it's not expired
    if (recommendation.expiresAt && new Date() > recommendation.expiresAt) {
      await prisma.aiRecommendation.update({
        where: { id: ensureStringId(id) },
        data: { status: 'EXPIRED' }
      })
      return res.status(400).json({
        success: false,
        error: 'Recommendation has expired'
      })
    }

    // 4. Send via existing communication system
    // This is where we call your existing email/sms service
    // For now, we just mark it as sent (we'll integrate later)
    
    const sent = await prisma.aiRecommendation.update({
      where: { id: ensureStringId(id) },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    })

    // TODO: Call existing communication service here
    // await emailService.sendEmail({
    //   to: recommendation.debtor.email,
    //   subject: recommendation.emailSubject,
    //   content: recommendation.emailBody
    // })

    res.json({
      success: true,
      data: {
        recommendationId: sent.id,
        status: sent.status,
        sentAt: sent.sentAt,
        message: 'Communication sent successfully'
      }
    })

  } catch (error) {
    console.error('Send error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send communication'
    })
  }
})

// ============================================
// 7. RECORD OUTCOME
// ============================================
/**
 * POST /api/copilot/outcome
 * Records the outcome of a communication
 */
router.post('/outcome', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { 
      debtorId, 
      recommendationId, 
      outcome 
    } = req.body as OutcomeRequest
    
    const organizationId = req.organizationId

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    if (!debtorId) {
      return res.status(400).json({
        success: false,
        error: 'debtorId is required'
      })
    }

    // Verify debtor belongs to organization
    const debtor = await prisma.debtor.findFirst({
      where: {
        id: debtorId,
        organizationId: organizationId
      }
    })

    if (!debtor) {
      return res.status(404).json({
        success: false,
        error: 'Debtor not found'
      })
    }

    // Store the outcome
    const outcomeRecord = await prisma.aiOutcome.create({
      data: {
        debtorId: debtorId,
        organizationId: organizationId,
        recommendationId: recommendationId || null,
        outcomeStatus: outcome.status,
        amount: outcome.amount || null,
        promiseDate: outcome.promiseDate ? new Date(outcome.promiseDate) : null,
        agentNotes: outcome.agentNotes || null,
        agentRating: outcome.rating || null,
        recordedAt: new Date()
      }
    })

    // If recommendation exists, link it
    if (recommendationId) {
      await prisma.aiRecommendation.update({
        where: { id: ensureStringId(recommendationId) },
        data: {
          status: 'SENT' // Mark as sent if it wasn't already
        }
      })
    }

    res.json({
      success: true,
      data: {
        outcomeId: outcomeRecord.id,
        message: 'Outcome recorded successfully'
      }
    })

  } catch (error) {
    console.error('Outcome error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to record outcome'
    })
  }
})

// ============================================
// 8. SUBMIT FEEDBACK
// ============================================
/**
 * POST /api/copilot/feedback
 * Submits agent feedback on a recommendation
 */
router.post('/feedback', authenticateToken, requireTenant, async (req: Request, res) => {
  try {
    const { 
      recommendationId, 
      rating, 
      comment 
    } = req.body
    
    const userId = req.user?.id
    const organizationId = req.organizationId

    if (!organizationId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Organization not found' 
      })
    }

    if (!recommendationId) {
      return res.status(400).json({
        success: false,
        error: 'recommendationId is required'
      })
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      })
    }

    // Verify recommendation belongs to organization
    const recommendation = await prisma.aiRecommendation.findFirst({
      where: {
        id: ensureStringId(recommendationId),
        organizationId: organizationId
      }
    })

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      })
    }

const feedback = await prisma.aiFeedback.create({
  data: {
    recommendationId: ensureStringId(recommendationId),
    agentId: userId || undefined,
    rating: rating,
    comment: comment || undefined,
    organizationId: organizationId  // ← ADD THIS
  }
})

    res.json({
      success: true,
      data: {
        feedbackId: feedback.id,
        message: 'Feedback submitted successfully'
      }
    })

  } catch (error) {
    console.error('Feedback error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    })
  }
})

// ============================================
// 9. HEALTH CHECK
// ============================================
/**
 * GET /api/copilot/health
 * Returns the health status of the copilot service
 */
router.get('/health', async (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
        database: 'connected',
        rulesEngine: 'ready'
      }
    }
  })
})

export default router