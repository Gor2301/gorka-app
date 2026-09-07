import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/analytics/overview
router.get('/overview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get total clients count
    const totalClients = await prisma.organization.count();

    // Get active clients count
    const activeClients = await prisma.organization.count({
      where: {
        users: {
          some: {}
        }
      }
    });

    // Get total debtors count for this organization
    const totalDebtors = await prisma.debtor.count({
      where: { organizationId }
    });

    // Get total debt
const debtResult = await prisma.debtor.aggregate({
  where: {
    organizationId: organizationId
  },
  _sum: {
    totalDebt: true
  }
});
const totalDebt = debtResult._sum.totalDebt || 0;

    // Monthly revenue (mock for now)
    const monthlyRevenue = 0;
    const clientGrowth = 0;
    const revenueGrowth = 0;
    const debtorGrowth = 0;
    const debtGrowth = 0;

    return res.json({
      success: true,
      data: {
        totalClients,
        activeClients,
        totalDebtors,
        totalDebt,
        monthlyRevenue,
        clientGrowth,
        revenueGrowth,
        debtorGrowth,
        debtGrowth
      }
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/usage
router.get('/usage', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get communication counts through debtor relation
    const emailsSent = await prisma.messageLog.count({
      where: { 
        debtor: {
          organizationId: organizationId
        },
        channel: 'EMAIL' 
      }
    });

    const smsSent = await prisma.messageLog.count({
      where: { 
        debtor: {
          organizationId: organizationId
        },
        channel: 'SMS' 
      }
    });

    // Mock AI calls
    const aiCalls = 0;

    return res.json({
      success: true,
      data: {
        emailsSent,
        smsSent,
        aiCalls
      }
    });
  } catch (error) {
    console.error('Error fetching usage metrics:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch usage metrics' });
  }
});

export default router;