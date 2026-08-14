import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { requireSuperAdmin } from '../middleware/super-admin.auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/admin/analytics/overview
 * Get platform overview KPI
 */
router.get('/overview', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const [
      totalOrganizations,
      totalUsers,
      totalDebtors,
      totalActions,
      totalCommunications,
      totalAiRecommendations,
      recentActivity
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.debtor.count(),
      prisma.action.count(),
      prisma.communicationHistory.count(),
      prisma.aiRecommendation.count(),
      prisma.activityLog.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      })
    ]);

    // Get organizations by status
    const organizationsByStatus = await prisma.organization.groupBy({
      by: ['status'],
      _count: true
    });

    // Get users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    });

    // Get actions by status
    const actionsByStatus = await prisma.action.groupBy({
      by: ['status'],
      _count: true
    });

    res.json({
      success: true,
      data: {
        kpis: {
          totalOrganizations,
          totalUsers,
          totalDebtors,
          totalActions,
          totalCommunications,
          totalAiRecommendations
        },
        breakdowns: {
          organizationsByStatus,
          usersByRole,
          actionsByStatus
        },
        recentActivity
      }
    });

  } catch (error) {
    logger.error('Error fetching analytics overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

export default router;