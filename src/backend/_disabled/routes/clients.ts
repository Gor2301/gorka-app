import express, { Request, Response } from 'express';
import { prisma } from '../database';
import { z } from 'zod';

const router = express.Router();

// GET /api/clients — List all clients (for Owner Dashboard)
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    // Get all organizations (clients) with counts
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        timezone: true,
        _count: {
          select: {
            users: {
              where: { role: 'AGENT' }
            },
            debtors: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get total debt for each organization
    const clients = await Promise.all(
      organizations.map(async (org: any) => {
        const debtResult = await prisma.debtor.aggregate({
          where: {
            organizationId: org.id
          },
          _sum: {
            totalDebt: true
          }
        });
        const totalDebt = debtResult._sum.totalDebt || 0;

        return {
          id: org.id,
          name: org.name,
          status: 'ACTIVE',
          plan: 'STARTER',
          totalDebtors: org._count?.debtors || 0,
          totalAgents: org._count?.users || 0,
          totalDebt: totalDebt,
          revenue: 0,
          lastSync: org.updatedAt || new Date().toISOString(),
        };
      })
    );

    return res.json({ success: true, data: clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch clients' });
  }
});

// GET /api/clients/:id — Get single client details
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        timezone: true,
        registrationNumber: true,
        taxId: true,
        primaryContact: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        clientType: true,
        website: true,
        billingEmail: true,
        billingPhone: true,
        verificationStatus: true,
        emailVerifiedAt: true,
        verifiedAt: true,
        suspendedAt: true,
        rejectedAt: true,
        termsAcceptedAt: true,
        verifiedBy: true,
        suspendedBy: true,
        reviewNotes: true,
        stripeCustomerId: true,
        stripePaymentMethodId: true,
        _count: {
          select: {
            users: {
              where: { role: 'AGENT' }
            },
            debtors: true,
            activityLogs: true,
          }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    // Get total debt for this organization
    const debtResult = await prisma.debtor.aggregate({
      where: {
        organizationId: id
      },
      _sum: {
        totalDebt: true
      }
    });
    const totalDebt = debtResult._sum.totalDebt || 0;

    // Transform to client detail format
    const client = {
      id: organization.id,
      name: organization.name,
      status: organization.verificationStatus || 'PENDING_EMAIL',
      plan: 'STARTER',
      joinedDate: organization.createdAt,
      lastSync: organization.updatedAt,
      totalDebtors: organization._count?.debtors || 0,
      totalAgents: organization._count?.users || 0,
      activeAgents: organization._count?.users || 0,
      totalDebt: totalDebt,
      totalRevenue: 0,
      monthlyRevenue: 0,
      syncStatus: 'ONLINE',
      lastActive: organization.updatedAt,
      aiCalls: 0,
      emailsSent: 0,
      smsSent: 0,
      recoveryRate: 0,
      type: organization.clientType || 'AGENCY',
      registrationNumber: organization.registrationNumber || '',
      taxId: organization.taxId || '',
      primaryContact: organization.primaryContact || '',
      contactEmail: organization.contactEmail || '',
      contactPhone: organization.contactPhone || '',
      address: organization.address || '',
      website: organization.website || '',
      billingEmail: organization.billingEmail || '',
      billingPhone: organization.billingPhone || '',
      verificationStatus: organization.verificationStatus || 'PENDING_EMAIL',
      emailVerifiedAt: organization.emailVerifiedAt,
      verifiedAt: organization.verifiedAt,
      suspendedAt: organization.suspendedAt,
      rejectedAt: organization.rejectedAt,
      termsAcceptedAt: organization.termsAcceptedAt,
      verifiedBy: organization.verifiedBy,
      suspendedBy: organization.suspendedBy,
      reviewNotes: organization.reviewNotes,
      renewalDate: '',
    };

    return res.json({ success: true, data: client });
  } catch (error) {
    console.error('Error fetching client:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch client' });
  }
});

// ==================== OWNER ACTIONS ====================

// ===== VERIFY CLIENT =====
router.post('/:id/verify', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { users: true }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    if (organization.verificationStatus === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Client is already active'
      });
    }

    if (organization.verificationStatus === 'SUSPENDED') {
      return res.status(400).json({
        success: false,
        error: 'Client is suspended. Please reinstate first.'
      });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: {
        verificationStatus: 'ACTIVE',
        verifiedAt: new Date(),
        verifiedBy: null,
        reviewNotes: notes || organization.reviewNotes
      }
    });

    await prisma.activityLog.create({
      data: {
        organizationId: id,
        userId: null,
        action: 'VERIFIED',
        entityType: 'ORGANIZATION',
        entityId: id,
        details: {
          previousStatus: organization.verificationStatus,
          newStatus: 'ACTIVE',
          notes: notes || null,
          performedBy: 'system'
        }
      }
    });

    console.log(`✅ Client ${organization.name} (${id}) verified`);

    return res.json({
      success: true,
      data: {
        message: `Client ${organization.name} has been verified and is now ACTIVE`,
        organizationId: id,
        verificationStatus: 'ACTIVE'
      }
    });
  } catch (error: any) {
    console.error('Verify client error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify client'
    });
  }
});

// ===== SUSPEND CLIENT =====
router.post('/:id/suspend', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason for suspension is required'
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { users: true }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    if (organization.verificationStatus === 'SUSPENDED') {
      return res.status(400).json({
        success: false,
        error: 'Client is already suspended'
      });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: {
        verificationStatus: 'SUSPENDED',
        suspendedAt: new Date(),
        suspendedBy: null,
        reviewNotes: reason
      }
    });

    await prisma.activityLog.create({
      data: {
        organizationId: id,
        userId: null,
        action: 'SUSPENDED',
        entityType: 'ORGANIZATION',
        entityId: id,
        details: {
          previousStatus: organization.verificationStatus,
          newStatus: 'SUSPENDED',
          reason: reason,
          performedBy: 'system'
        }
      }
    });

    console.log(`⛔ Client ${organization.name} (${id}) suspended`);

    return res.json({
      success: true,
      data: {
        message: `Client ${organization.name} has been suspended`,
        organizationId: id,
        verificationStatus: 'SUSPENDED'
      }
    });
  } catch (error: any) {
    console.error('Suspend client error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to suspend client'
    });
  }
});

// ===== REJECT CLIENT =====
router.post('/:id/reject', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason for rejection is required'
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { users: true }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    if (organization.verificationStatus === 'REJECTED') {
      return res.status(400).json({
        success: false,
        error: 'Client is already rejected'
      });
    }

    if (organization.verificationStatus === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject an active client. Suspend first if needed.'
      });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: {
        verificationStatus: 'REJECTED',
        rejectedAt: new Date(),
        reviewNotes: reason
      }
    });

    await prisma.activityLog.create({
      data: {
        organizationId: id,
        userId: null,
        action: 'REJECTED',
        entityType: 'ORGANIZATION',
        entityId: id,
        details: {
          previousStatus: organization.verificationStatus,
          newStatus: 'REJECTED',
          reason: reason,
          performedBy: 'system'
        }
      }
    });

    console.log(`❌ Client ${organization.name} (${id}) rejected`);

    return res.json({
      success: true,
      data: {
        message: `Client ${organization.name} has been rejected`,
        organizationId: id,
        verificationStatus: 'REJECTED'
      }
    });
  } catch (error: any) {
    console.error('Reject client error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject client'
    });
  }
});

// ===== REINSTATE CLIENT =====
router.post('/:id/reinstate', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { users: true }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    if (organization.verificationStatus !== 'SUSPENDED') {
      return res.status(400).json({
        success: false,
        error: 'Only suspended clients can be reinstated'
      });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: {
        verificationStatus: 'ACTIVE',
        suspendedAt: null,
        suspendedBy: null,
        reviewNotes: notes || organization.reviewNotes
      }
    });

    await prisma.activityLog.create({
      data: {
        organizationId: id,
        userId: null,
        action: 'REINSTATED',
        entityType: 'ORGANIZATION',
        entityId: id,
        details: {
          previousStatus: 'SUSPENDED',
          newStatus: 'ACTIVE',
          notes: notes || null,
          performedBy: 'system'
        }
      }
    });

    console.log(`🔄 Client ${organization.name} (${id}) reinstated`);

    return res.json({
      success: true,
      data: {
        message: `Client ${organization.name} has been reinstated and is now ACTIVE`,
        organizationId: id,
        verificationStatus: 'ACTIVE'
      }
    });
  } catch (error: any) {
    console.error('Reinstate client error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reinstate client'
    });
  }
});

// ===== UPDATE CLIENT =====
const updateClientSchema = z.object({
  name: z.string().optional(),
  clientType: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  primaryContact: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  billingEmail: z.string().email().optional(),
  billingPhone: z.string().optional()
});

router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const validation = updateClientSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const data = validation.data;

    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: data
    });

    await prisma.activityLog.create({
      data: {
        organizationId: id,
        userId: null,
        action: 'UPDATED',
        entityType: 'ORGANIZATION',
        entityId: id,
        details: {
          updatedFields: Object.keys(data),
          performedBy: 'system'
        }
      }
    });

    console.log(`📝 Client ${organization.name} (${id}) updated`);

    return res.json({
      success: true,
      data: {
        message: `Client updated successfully`,
        organization: updatedOrg
      }
    });
  } catch (error: any) {
    console.error('Update client error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update client'
    });
  }
});

export default router;