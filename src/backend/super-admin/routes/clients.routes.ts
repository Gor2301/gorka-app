import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../config/logger';
import { requireSuperAdmin } from '../middleware/super-admin.auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/admin/clients
 * Get all clients (organizations) with pagination
 */
router.get('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', search, status } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { slug: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    if (status) {
      where.status = status as string;
    }

    const [clients, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              debtors: true,
              actions: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.organization.count({ where })
    ]);

    res.json({
      success: true,
      data: clients,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error) {
    logger.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients'
    });
  }
});

/**
 * GET /api/v1/admin/clients/:id
 * Get a single client by ID
 */
router.get('/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const client = await prisma.organization.findUnique({
      where: { id: id as string },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            users: true,
            debtors: true,
            actions: true,
            aiRecommendations: true,
            communicationHistory: true
          }
        }
      }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      data: client
    });

  } catch (error) {
    logger.error(`Error fetching client ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client'
    });
  }
});

export default router;