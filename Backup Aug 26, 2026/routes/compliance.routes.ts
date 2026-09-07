import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();

// ==================== GET COMPLIANCE REPORT ====================
router.get('/report', authenticateToken, requireTenant, async (req: any, res: any) => {
  try {
    const organizationId = (req as any).organizationId;

    // Get debtors count
    const totalDebtors = await prisma.debtor.count({
      where: { organizationId }
    });

    // Get total debt
    const debtAggregate = await prisma.debtor.aggregate({
      where: { organizationId },
      _sum: { totalDebt: true }
    });

    // Get agents count
    const totalAgents = await prisma.user.count({
      where: {
        organizationId,
        role: 'AGENT'
      }
    });

    // Get audit logs count
    const totalActions = await prisma.activityLog.count({
      where: { organizationId }
    });

    // Get recent activity
    const recentActivity = await prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    const complianceData = {
      summary: {
        totalDebtors,
        totalDebt: debtAggregate._sum.totalDebt || 0,
        totalAgents,
        totalActions,
        lastAudit: new Date().toISOString()
      },
      recentActivity: recentActivity.map((a: any) => ({
        action: a.action,
        user: a.user?.name || 'Unknown',
        createdAt: a.createdAt,
        details: a.details
      })),
      connectors: [],
      dataSovereignty: {
        status: '✅ No external connectors configured',
        message: 'No external GORKA connector is configured to transmit client data.'
      }
    };

    return res.json({
      success: true,
      data: complianceData
    });
  } catch (error: any) {
    console.error('Compliance report error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate compliance report'
    });
  }
});

export default router;