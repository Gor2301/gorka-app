import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// ─── GET /api/dashboard/stats ──────────────────────────────────────────
router.get('/stats', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const organizationId = user.organizationId;

    // Get user count (agents)
    let totalAgents = 0;
    try {
      totalAgents = await prisma.user.count({
        where: {
          organizationId,
          role: 'AGENT',
        },
      });
    } catch (error) {
      console.error('Error counting agents:', error);
      totalAgents = 0;
    }

    // Get support ticket count
    let supportTickets = 0;
    try {
      supportTickets = await prisma.supportTicket.count({
        where: { organizationId },
      });
    } catch (error) {
      console.error('Error counting support tickets:', error);
      supportTickets = 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalDebtors: 0,
        totalDebts: 0,
        pendingActions: 0,
        totalAgents,
        supportTickets,
        recentActivity: [],
      },
    });
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats',
    });
  }
});

// ─── GET /api/dashboard/activity ──────────────────────────────────────
router.get('/activity', authenticateToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    return res.status(200).json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('❌ Activity error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch activity',
    });
  }
});

export default router;