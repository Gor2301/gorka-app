import { Router, Request, Response } from 'express';
import { ActionService } from '../services/action.service';
import { logger } from '../config/logger';
import { requireTenant } from '../middleware/tenant';

const router = Router();

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
 * GET /api/actions
 * Get all actions with filters
 */
router.get('/', requireTenant, async (req: Request, res: Response) => {
  try {
    const { debtorId, status, type, assignedTo, page, limit } = req.query;

    const result = await ActionService.getActions({
      debtorId: debtorId as string,
      status: status as string,
      type: type as string,
      assignedTo: assignedTo as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      organizationId: req.organizationId, // ← Pass org filter
    });

    res.json({
      success: true,
      data: result.actions,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error in GET /api/actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch actions',
    });
  }
});

/**
 * GET /api/actions/stats
 * Get action statistics
 */
router.get('/stats', requireTenant, async (req: Request, res: Response) => {
  try {
    const stats = await ActionService.getActionStats(req.organizationId); // ← Pass org filter
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error in GET /api/actions/stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action stats',
    });
  }
});

/**
 * GET /api/actions/:id
 * Get a single action by ID
 */
router.get('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const action = await ActionService.getActionById(id as string, req.organizationId); // ← Pass org filter

    res.json({
      success: true,
      data: action,
    });
  } catch (error) {
    logger.error(`Error in GET /api/actions/${req.params.id}:`, error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch action',
      });
    }
  }
});

/**
 * GET /api/debtors/:debtorId/actions
 * Get actions for a specific debtor
 */
router.get('/debtor/:debtorId', requireTenant, async (req: Request, res: Response) => {
  try {
    const { debtorId } = req.params;
    const actions = await ActionService.getDebtorActions(debtorId as string, req.organizationId); // ← Pass org filter

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    logger.error(`Error in GET /api/debtors/${req.params.debtorId}/actions:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch debtor actions',
    });
  }
});

/**
 * POST /api/actions
 * Create a new action
 */
router.post('/', requireTenant, async (req: Request, res: Response) => {
  try {
    const { debtorId, type, title, description, dueDate, assignedTo, metadata } = req.body;

    // Validation
    if (!debtorId) {
      return res.status(400).json({
        success: false,
        error: 'debtorId is required',
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'type is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'title is required',
      });
    }

    const action = await ActionService.createAction({
      debtorId,
      type,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedTo,
      metadata,
      organizationId: req.organizationId, // ← Pass org from JWT
    });

    res.status(201).json({
      success: true,
      data: action,
      message: 'Action created successfully',
    });
  } catch (error) {
    logger.error('Error in POST /api/actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create action',
    });
  }
});

/**
 * PUT /api/actions/:id
 * Update an action
 */
router.put('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, status, title, description, dueDate, assignedTo, metadata } = req.body;

    const action = await ActionService.updateAction(id as string, {
      type,
      status,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedTo,
      metadata,
      organizationId: req.organizationId, // ← Pass org from JWT
    });

    res.json({
      success: true,
      data: action,
      message: 'Action updated successfully',
    });
  } catch (error) {
    logger.error(`Error in PUT /api/actions/${req.params.id}:`, error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    } else if (error instanceof Error && error.message.includes('not authorized')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update action',
      });
    }
  }
});

/**
 * DELETE /api/actions/:id
 * Delete an action
 */
router.delete('/:id', requireTenant, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ActionService.deleteAction(id as string, req.organizationId); // ← Pass org filter

    res.json({
      success: true,
      message: 'Action deleted successfully',
    });
  } catch (error) {
    logger.error(`Error in DELETE /api/actions/${req.params.id}:`, error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    } else if (error instanceof Error && error.message.includes('not authorized')) {
      res.status(403).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete action',
      });
    }
  }
});

export default router;