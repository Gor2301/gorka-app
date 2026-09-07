import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { requireTenant } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      user?: any;
    }
  }
}

/**
 * GET /api/debtors
 * Get all debtors with optional filters
 */
router.get('/', requireTenant, async (req: Request, res: Response) => {
  try {
    const { search, status, page = '1', limit = '50' } = req.query;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      organizationId: req.organizationId
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    if (status) {
      where.status = status as string;
    }

    const [debtors, total] = await Promise.all([
      prisma.debtor.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true
            }
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          actions: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 5
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.debtor.count({ where })
    ]);

    res.json({
      success: true,
      data: debtors,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error('Error fetching debtors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch debtors'
    });
  }
});

/**
 * GET /api/debtors/:id
 * Get a single debtor by ID
 */
router.get('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const debtor = await prisma.debtor.findFirst({
      where: {
        id: id as string,
        organizationId: req.organizationId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        actions: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        messageLogs: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    });

    if (!debtor) {
      return res.status(404).json({
        success: false,
        error: 'Debtor not found'
      });
    }

    res.json({
      success: true,
      data: debtor
    });
  } catch (error) {
    logger.error(`Error fetching debtor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch debtor'
    });
  }
});

/**
 * POST /api/debtors
 * Create a new debtor
 */
router.post('/', requireTenant, async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      address, 
      dateOfBirth, 
      identification, 
      riskScore, 
      tags, 
      assignedTo,
      metadata 
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Use organizationId from JWT (don't trust request body)
    const orgId = req.organizationId;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required'
      });
    }

    const debtor = await prisma.debtor.create({
      data: {
        name,
        email,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        identification,
        riskScore: riskScore || 0,
        tags: tags || [],
        organizationId: orgId,
        assignedTo: assignedTo || null,
        metadata: metadata || {},
        status: 'ACTIVE'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info(`Debtor created: ${debtor.id} - ${debtor.name}`);
    
    res.status(201).json({
      success: true,
      data: debtor,
      message: 'Debtor created successfully'
    });
  } catch (error) {
    logger.error('Error creating debtor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create debtor'
    });
  }
});

/**
 * PUT /api/debtors/:id
 * Update a debtor
 */
router.put('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      email, 
      phone, 
      address, 
      dateOfBirth, 
      identification, 
      riskScore, 
      tags, 
      status,
      assignedTo,
      metadata 
    } = req.body;

    // Check if debtor exists and belongs to this org
    const existing = await prisma.debtor.findFirst({
      where: {
        id: id as string,
        organizationId: req.organizationId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Debtor not found'
      });
    }

    const debtor = await prisma.debtor.update({
      where: { id: id as string },
      data: {
        name: name || existing.name,
        email: email !== undefined ? email : existing.email,
        phone: phone !== undefined ? phone : existing.phone,
        address: address !== undefined ? address : existing.address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existing.dateOfBirth,
        identification: identification !== undefined ? identification : existing.identification,
        riskScore: riskScore !== undefined ? riskScore : existing.riskScore,
        tags: tags !== undefined ? tags : existing.tags,
        status: status || existing.status,
        assignedTo: assignedTo !== undefined ? assignedTo : existing.assignedTo,
        metadata: metadata || existing.metadata
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info(`Debtor updated: ${debtor.id} - ${debtor.name}`);
    
    res.json({
      success: true,
      data: debtor,
      message: 'Debtor updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating debtor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update debtor'
    });
  }
});

/**
 * DELETE /api/debtors/:id
 * Soft delete a debtor
 */
router.delete('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if debtor exists and belongs to this org
    const existing = await prisma.debtor.findFirst({
      where: {
        id: id as string,
        organizationId: req.organizationId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Debtor not found'
      });
    }

    // Soft delete - update status and set deletedAt
    await prisma.debtor.update({
      where: { id: id as string },
      data: {
        status: 'DELETED',
        deletedAt: new Date()
      }
    });

    logger.info(`Debtor deleted (soft): ${id}`);
    
    res.json({
      success: true,
      message: 'Debtor deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting debtor ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete debtor'
    });
  }
});

/**
 * GET /api/debtors/stats
 * Get debtor statistics
 */
router.get('/stats', requireTenant, async (req: Request, res: Response) => {
  try {
    const [total, byStatus, byRiskScore] = await Promise.all([
      prisma.debtor.count({
        where: { organizationId: req.organizationId }
      }),
      prisma.debtor.groupBy({
        by: ['status'],
        where: { organizationId: req.organizationId },
        _count: true
      }),
      prisma.debtor.groupBy({
        by: ['riskScore'],
        where: { organizationId: req.organizationId },
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        byStatus,
        byRiskScore
      }
    });
  } catch (error) {
    logger.error('Error fetching debtor stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch debtor stats'
    });
  }
});

export default router;