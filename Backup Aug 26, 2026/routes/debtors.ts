import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();

// ==================== GET ALL DEBTORS ====================
router.get('/', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = req.organizationId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search as string || '';

    const where: any = { organizationId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [debtors, total] = await Promise.all([
      prisma.debtor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
        // ✅ REMOVED messageLogs - doesn't exist in schema
      }),
      prisma.debtor.count({ where })
    ]);

    return res.json({
      success: true,
      data: debtors,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    console.error('Get debtors error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch debtors'
    });
  }
});

// ==================== GET SINGLE DEBTOR ====================
router.get('/:id', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;

    const debtor = await prisma.debtor.findFirst({
      where: {
        id,
        organizationId
      }
      // ✅ REMOVED messageLogs - doesn't exist in schema
    });

    if (!debtor) {
      return res.status(404).json({
        success: false,
        error: 'Debtor not found'
      });
    }

    return res.json({
      success: true,
      data: debtor
    });
  } catch (error: any) {
    console.error('Get debtor error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch debtor'
    });
  }
});

// ==================== CREATE DEBTOR ====================
router.post('/', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = req.organizationId;
    const { name, email, phone, totalDebt, nextFollowUpDate, nextPaymentDate } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    const debtor = await prisma.debtor.create({
      data: {
        name,
        email,
        phone,
        totalDebt: totalDebt || 0,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
        nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate) : null,
        organizationId
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'DEBTOR',
        entityId: debtor.id,
        details: { name }
      }
    });

    return res.status(201).json({
      success: true,
      data: debtor
    });
  } catch (error: any) {
    console.error('Create debtor error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create debtor'
    });
  }
});

// ==================== UPDATE DEBTOR ====================
router.put('/:id', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;
    const { name, email, phone, totalDebt, nextFollowUpDate, nextPaymentDate } = req.body;

    // Check if debtor exists
    const existing = await prisma.debtor.findFirst({
      where: {
        id,
        organizationId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Debtor not found'
      });
    }

    const debtor = await prisma.debtor.update({
      where: { id },
      data: {
        name: name || existing.name,
        email: email !== undefined ? email : existing.email,
        phone: phone !== undefined ? phone : existing.phone,
        totalDebt: totalDebt !== undefined ? totalDebt : existing.totalDebt,
        nextFollowUpDate: nextFollowUpDate !== undefined ? (nextFollowUpDate ? new Date(nextFollowUpDate) : null) : existing.nextFollowUpDate,
        nextPaymentDate: nextPaymentDate !== undefined ? (nextPaymentDate ? new Date(nextPaymentDate) : null) : existing.nextPaymentDate
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId: req.user.id,
        action: 'UPDATE',
        entityType: 'DEBTOR',
        entityId: debtor.id,
        details: { name: debtor.name }
      }
    });

    return res.json({
      success: true,
      data: debtor
    });
  } catch (error: any) {
    console.error('Update debtor error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update debtor'
    });
  }
});

// ==================== DELETE DEBTOR ====================
router.delete('/:id', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;

    // Check if debtor exists
    const existing = await prisma.debtor.findFirst({
      where: {
        id,
        organizationId
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Debtor not found'
      });
    }

    await prisma.debtor.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId: req.user.id,
        action: 'DELETE',
        entityType: 'DEBTOR',
        entityId: id,
        details: { name: existing.name }
      }
    });

    return res.json({
      success: true,
      message: 'Debtor deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete debtor error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete debtor'
    });
  }
});

// ==================== BULK UPLOAD DEBTORS ====================
router.post('/bulk', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = req.organizationId;
    const { debtors } = req.body;

    if (!debtors || !Array.isArray(debtors) || debtors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debtors array is required and must not be empty'
      });
    }

    const created = [];
    const errors = [];

    for (const debtorData of debtors) {
      try {
        const { name, email, phone, totalDebt, nextFollowUpDate, nextPaymentDate } = debtorData;
        
        if (!name) {
          errors.push({ ...debtorData, error: 'Name is required' });
          continue;
        }

        const debtor = await prisma.debtor.create({
          data: {
            name,
            email: email || null,
            phone: phone || null,
            totalDebt: totalDebt || 0,
            nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
            nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate) : null,
            organizationId
          }
        });

        created.push(debtor);
      } catch (error: any) {
        errors.push({ ...debtorData, error: error.message });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId: req.user.id,
        action: 'UPLOAD',
        entityType: 'DEBTOR',
        details: { 
          total: debtors.length,
          created: created.length,
          errors: errors.length
        }
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        created,
        errors,
        total: debtors.length,
        succeeded: created.length,
        failed: errors.length
      }
    });
  } catch (error: any) {
    console.error('Bulk upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload debtors'
    });
  }
});

export default router;