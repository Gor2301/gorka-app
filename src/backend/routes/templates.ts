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
 * GET /api/templates
 * Get all templates
 */
router.get('/', requireTenant, async (req: Request, res: Response) => {
  try {
    const { channel, type, status, page = '1', limit = '50' } = req.query;
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      organizationId: req.organizationId // ← NEW: Filter by org
    };
    if (channel) where.channel = channel as string;
    if (type) where.type = type as string;
    if (status) where.status = status as string;

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        include: {
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
      prisma.template.count({ where })
    ]);

    res.json({
      success: true,
      data: templates,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

/**
 * GET /api/templates/:id
 * Get a single template by ID
 */
router.get('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const template = await prisma.template.findFirst({
      where: {
        id: id as string,
        organizationId: req.organizationId // ← NEW: Filter by org
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error fetching template ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/', requireTenant, async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      subject, 
      content, 
      channel, 
      type, 
      description, 
      variables
    } = req.body;

    const orgId = req.organizationId;

    if (!name || !content || !channel) {
      return res.status(400).json({
        success: false,
        error: 'name, content, and channel are required'
      });
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'Organization not found'
      });
    }

    const template = await prisma.template.create({
      data: {
        name,
        subject: subject || null,
        content,
        channel,
        type: type || 'CUSTOM',
        description: description || null,
        variables: variables || [],
        organizationId: orgId, // ← NEW: Use org from JWT
        status: 'ACTIVE'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    logger.info(`Template created: ${template.id} - ${template.name}`);
    
    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
});

/**
 * PUT /api/templates/:id
 * Update a template
 */
router.put('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, subject, content, channel, type, description, variables, status } = req.body;

    // First verify template belongs to this org
    const existing = await prisma.template.findFirst({
      where: {
        id: id as string,
        organizationId: req.organizationId // ← NEW: Check org
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const template = await prisma.template.update({
      where: { id: id as string },
      data: {
        name: name || existing.name,
        subject: subject !== undefined ? subject : existing.subject,
        content: content || existing.content,
        channel: channel || existing.channel,
        type: type || existing.type,
        description: description !== undefined ? description : existing.description,
        variables: variables || existing.variables,
        status: status || existing.status
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    logger.info(`Template updated: ${template.id} - ${template.name}`);
    
    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating template ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template'
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a template
 */
router.delete('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // First verify template belongs to this org
    const existing = await prisma.template.findFirst({
      where: {
        id: id as string,
        organizationId: req.organizationId // ← NEW: Check org
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    await prisma.template.delete({
      where: { id: id as string }
    });

    logger.info(`Template deleted: ${id}`);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting template ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template'
    });
  }
});

/**
 * GET /api/templates/stats
 * Get template statistics
 */
router.get('/stats', requireTenant, async (req: Request, res: Response) => {
  try {
    const where = { organizationId: req.organizationId }; // ← NEW: Filter by org

    const [total, byChannel, byType, byStatus] = await Promise.all([
      prisma.template.count({ where }),
      prisma.template.groupBy({
        by: ['channel'],
        where,
        _count: true
      }),
      prisma.template.groupBy({
        by: ['type'],
        where,
        _count: true
      }),
      prisma.template.groupBy({
        by: ['status'],
        where,
        _count: true
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        byChannel,
        byType,
        byStatus
      }
    });
  } catch (error) {
    logger.error('Error fetching template stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template stats'
    });
  }
});

export default router;