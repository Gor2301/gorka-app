import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { requireSuperAdmin } from '../middleware/super-admin.auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/admin/audit
 * Get audit logs with pagination
 */
router.get('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', action, entityType, userId } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (action) where.action = action as string;
    if (entityType) where.entityType = entityType as string;
    if (userId) where.userId = userId as string;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          },
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.activityLog.count({ where })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

export default router;