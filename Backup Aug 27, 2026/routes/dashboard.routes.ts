import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();

// ==================== GET DASHBOARD STATS ====================
router.get('/stats', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = req.organizationId;

    // Get total debtors
    const totalDebtors = await prisma.debtor.count({
      where: { organizationId }
    });

    // Get total debt
    const debtAggregate = await prisma.debtor.aggregate({
      where: { organizationId },
      _sum: {
        totalDebt: true
      }
    });

    // Get agents count
    const totalAgents = await prisma.user.count({
      where: {
        organizationId,
        role: 'AGENT'
      }
    });

    // Get recent activity
    let recentActivities: any[] = []; // ✅ FIXED: Added type annotation

    try {
      recentActivities = await prisma.activityLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }

    return res.json({
      success: true,
      data: {
        totalDebtors,
        totalDebt: debtAggregate._sum.totalDebt || 0,
        totalAgents,
        recentActivities: recentActivities.map((activity: any) => ({
          id: activity.id,
          action: activity.action,
          user: activity.user?.name || 'Unknown',
          createdAt: activity.createdAt,
          entityType: activity.entityType,
          details: activity.details
        }))
      }
    });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard stats'
    });
  }
});

// ==================== GET RECENT ACTIVITY ====================
router.get('/recent-activity', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = req.organizationId;
    const limit = parseInt(req.query.limit as string) || 10;

    const activities = await prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return res.json({
      success: true,
      data: activities.map((activity: any) => ({
        id: activity.id,
        action: activity.action,
        user: activity.user?.name || 'Unknown',
        createdAt: activity.createdAt,
        entityType: activity.entityType,
        entityId: activity.entityId,
        details: activity.details
      }))
    });
  } catch (error: any) {
    console.error('Recent activity error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch recent activity'
    });
  }
});

export default router;