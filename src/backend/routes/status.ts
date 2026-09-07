import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// ─── GET /api/status ──────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: 'operational',
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        services: [
          { name: 'API', status: 'operational' },
          { name: 'Database', status: 'operational' },
        ],
      },
    });
  } catch (error) {
    console.error('❌ Status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get status',
    });
  }
});

// ─── GET /api/status/health ──────────────────────────────────────────────
router.get('/health', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

// ─── GET /api/status/overview ────────────────────────────────────────────
router.get('/overview', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // ✅ Wrapped in try/catch for missing tables
    let debtorCount = 0;
    let agentCount = 0;
    let actionCount = 0;

    try {
      debtorCount = await prisma.debtor.count({ where: { organizationId: user.organizationId } });
    } catch {
      debtorCount = 0;
    }

    try {
      agentCount = await prisma.user.count({ where: { organizationId: user.organizationId, role: 'AGENT' } });
    } catch {
      agentCount = 0;
    }

    try {
      actionCount = await prisma.action.count({ where: { assignedTo: user.userId, status: 'PENDING' } });
    } catch {
      actionCount = 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        debtors: debtorCount,
        agents: agentCount,
        pendingActions: actionCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Overview error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get overview',
    });
  }
});

// ─── GET /api/status/system ──────────────────────────────────────────────
router.get('/system', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: 'operational',
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ System status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get system status',
    });
  }
});

export default router;