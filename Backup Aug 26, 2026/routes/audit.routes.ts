import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { maskEmail, maskPhone, maskName } from '../utils/mask';

const router = Router();
const prisma = new PrismaClient();

// ==================== GET AUDIT LOGS ====================
router.get('/logs', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = (req as any).organizationId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build where conditions for Prisma (not raw SQL)
    const where: any = {
      organizationId: organizationId
    };

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate)
      };
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate)
      };
    }

    // Get total count
    const total = await prisma.activityLog.count({ where });

    // Get logs with user info using Prisma (not raw SQL)
    const logs = await prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Mask PII in logs
    const maskedLogs = logs.map((log: any) => {
      const maskedLog = {
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        userName: log.user?.name || 'Unknown',
        userEmail: log.user?.email ? maskEmail(log.user.email) : '',
        details: log.details
      };

      // Mask sensitive data in details
      if (log.details && typeof log.details === 'object') {
        const details = { ...log.details };
        if (details.email) {
          details.email = maskEmail(details.email);
        }
        if (details.phone) {
          details.phone = maskPhone(details.phone);
        }
        if (details.name) {
          details.name = maskName(details.name);
        }
        maskedLog.details = details;
      }

      return maskedLog;
    });

    return res.json({
      success: true,
      data: maskedLogs,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch audit logs'
    });
  }
});

// ==================== GET AUDIT ACTIONS ====================
router.get('/actions', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = (req as any).organizationId;

    const actions = await prisma.activityLog.findMany({
      where: { organizationId },
      distinct: ['action'],
      select: { action: true }
    });

    return res.json({
      success: true,
      data: actions.map((a: any) => a.action)
    });
  } catch (error: any) {
    console.error('Get audit actions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch audit actions'
    });
  }
});

// ==================== EXPORT AUDIT LOGS TO CSV ====================
router.get('/export/csv', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = (req as any).organizationId;
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build where conditions
    const where: any = {
      organizationId: organizationId
    };

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate)
      };
    }

    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate)
      };
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Create CSV
    let csv = 'ID,Action,Entity Type,User,User Email,IP Address,Details,Created At\n';
    
    logs.forEach((log: any) => {
      const details = log.details && typeof log.details === 'object' 
        ? JSON.stringify(log.details).replace(/,/g, ';') 
        : '';
      
      const userEmail = log.user?.email ? maskEmail(log.user.email) : '';
      
      csv += `${log.id},${log.action},${log.entityType || ''},${log.user?.name || 'Unknown'},${userEmail},${log.ipAddress || ''},"${details}",${log.createdAt}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    
    return res.send(csv);
  } catch (error: any) {
    console.error('Export audit logs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export audit logs'
    });
  }
});

export default router;