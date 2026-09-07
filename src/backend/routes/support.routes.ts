import { Router, Request, Response } from 'express';
import { prisma } from '../database';
import { z } from 'zod';

const router = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createTicketSchema = z.object({
  organizationId: z.string(),
  subject: z.string().min(1),
  message: z.string().min(1),
  category: z.string().default('OTHER'),
  priority: z.string().default('MEDIUM'),
  openedByEmail: z.string().email(),
  openedByName: z.string().optional(),
  source: z.string().default('PORTAL'),
  isPersonal: z.boolean().optional().default(false)
});

const replySchema = z.object({
  message: z.string().min(1),
  isInternal: z.boolean().default(false),
  sentBy: z.string()
});

const statusUpdateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'RESOLVED', 'CLOSED'])
});

const assignSchema = z.object({
  assignedTo: z.string()
});

const escalateSchema = z.object({
  escalationReason: z.string()
});

// ============================================
// TICKET NUMBER GENERATION
// ============================================

const generateTicketNumber = async (tx: any): Promise<number> => {
  const counter = await tx.ticketCounter.update({
    where: { id: 'default' },
    data: { lastNumber: { increment: 1 } }
  });
  return counter.lastNumber;
};

// ============================================
// STATUS TRANSITION VALIDATOR
// ============================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_CLIENT', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_FOR_CLIENT', 'RESOLVED'],
  WAITING_FOR_CLIENT: ['IN_PROGRESS', 'OPEN'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN']
};

const isValidTransition = (from: string, to: string): boolean => {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
};

// ============================================
// ENDPOINTS
// ============================================

// POST /api/support/tickets
router.post('/tickets', async (req: Request, res: Response): Promise<any> => {
  try {
    const validation = createTicketSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const data = validation.data;
    const user = (req as any).user;

    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    // 🔐 PERSONAL TICKET LOGIC
    let isPersonal = false;
    let assignedTo = null;

    if (data.isPersonal === true && user && user.role === 'OWNER') {
      isPersonal = true;
      assignedTo = 'platform_owner';
      data.source = 'SUPERADMIN';
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await generateTicketNumber(tx);

      const newTicket = await tx.supportTicket.create({
        data: {
          ticketNumber,
          organizationId: data.organizationId,
          subject: data.subject,
          message: data.message,
          category: data.category,
          priority: data.priority,
          status: 'OPEN',
          source: data.source || 'PORTAL',
          openedBy: user.id,
          openedByEmail: data.openedByEmail,
          openedByName: data.openedByName,
          isDeleted: false,
          isPersonal: isPersonal,
          assignedTo: assignedTo,
          readAt: null,
        }
      });

      await tx.supportTicketEvent.create({
        data: {
          ticketId: newTicket.id,
          eventType: 'CREATED',
          actorId: data.openedByEmail,
          actorName: data.openedByName || data.openedByEmail,
          newValue: {
            subject: data.subject,
            priority: data.priority,
            category: data.category,
            isPersonal: isPersonal
          }
        }
      });

      return newTicket;
    });

    return res.status(201).json({
      success: true,
      data: ticket
    });
  } catch (error: any) {
    console.error('Create ticket error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create ticket'
    });
  }
});

// GET /api/support/tickets
router.get('/tickets', async (req: Request, res: Response): Promise<any> => {
  try {
    const { status, priority, category, search, page = 1, limit = 25 } = req.query;

    const where: any = { isDeleted: false };

    if (status && status !== 'ALL') where.status = status;
    if (priority && priority !== 'ALL') where.priority = priority;
    if (category && category !== 'ALL') where.category = category;

    if (search) {
      where.OR = [
        { subject: { contains: search as string, mode: 'insensitive' } },
        { openedByEmail: { contains: search as string, mode: 'insensitive' } },
        { openedByName: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limitNum,
        skip: (pageNum - 1) * limitNum,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              contactEmail: true
            }
          }
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    return res.json({
      success: true,
      data: {
        tickets,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Get tickets error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tickets'
    });
  }
});

// GET /api/support/tickets/stats
router.get('/tickets/stats', async (req: Request, res: Response): Promise<any> => {
  try {
    const [open, inProgress, waitingForClient, resolved, closed, total] = await Promise.all([
      prisma.supportTicket.count({ where: { status: 'OPEN', isDeleted: false } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS', isDeleted: false } }),
      prisma.supportTicket.count({ where: { status: 'WAITING_FOR_CLIENT', isDeleted: false } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED', isDeleted: false } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED', isDeleted: false } }),
      prisma.supportTicket.count({ where: { isDeleted: false } })
    ]);

    return res.json({
      success: true,
      data: { open, inProgress, waitingForClient, resolved, closed, total }
    });
  } catch (error: any) {
    console.error('Get ticket stats error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get ticket stats'
    });
  }
});

// GET /api/support/tickets/my — Agency Owner's own personal tickets
router.get('/tickets/my', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;

console.log('🔍 /my - User role:', user?.role);

    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden — Only Agency Owners can access their personal tickets'
      });
    }

    const tickets = await prisma.supportTicket.findMany({
      where: {
        openedBy: user.id,
        isPersonal: true,
        isDeleted: false
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      data: tickets
    });
  } catch (error: any) {
    console.error('Get my tickets error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get your tickets'
    });
  }
});

// GET /api/support/tickets/personal — Platform Owner sees ALL personal tickets
router.get('/tickets/personal', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;


console.log('🔍 /personal - User from req.user:', user);
console.log('🔍 /personal - User role:', user?.role);

    if (!user || user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden — Only Platform Owner can access all personal tickets'
      });
    }

    const tickets = await prisma.supportTicket.findMany({
      where: {
        isPersonal: true,
        isDeleted: false
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      data: tickets
    });
  } catch (error: any) {
    console.error('Get personal tickets error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get personal tickets'
    });
  }
});

// GET /api/support/tickets/unread-count — Platform Owner sees unread personal tickets
router.get('/tickets/unread-count', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;

console.log('🔍 /unread-count - User from req.user:', user);
console.log('🔍 /unread-count - User role:', user?.role);


    if (!user || user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden — Only Platform Owner can access unread count'
      });
    }

    const count = await prisma.supportTicket.count({
      where: {
        isPersonal: true,
        readAt: null,
        isDeleted: false
      }
    });

    return res.json({
      success: true,
      data: { count }
    });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count'
    });
  }
});

// PATCH /api/support/tickets/:id/read — Mark a ticket as read
router.patch('/tickets/:id/read', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user || user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden — Only Platform Owner can mark tickets as read'
      });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id, isDeleted: false }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { readAt: new Date() }
    });

    return res.json({
      success: true,
      data: updated
    });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark ticket as read'
    });
  }
});

// GET /api/support/tickets/:id
router.get('/tickets/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id, isDeleted: false },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
            primaryContact: true
          }
        },
        replies: {
          orderBy: { createdAt: 'asc' }
        },
        events: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    return res.json({
      success: true,
      data: ticket
    });
  } catch (error: any) {
    console.error('Get ticket error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get ticket'
    });
  }
});

// POST /api/support/tickets/:id/reply
router.post('/tickets/:id/reply', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const validation = replySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const { message, isInternal, sentBy } = validation.data;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id, isDeleted: false }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    if (ticket.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        error: 'This ticket is closed. Please create a new ticket.'
      });
    }

    const user = (req as any).user;

    if (ticket.isPersonal) {
      if (user.role === 'PLATFORM_OWNER') {
        // ✅ Allowed
      } else if (user.role === 'OWNER' && ticket.openedBy === user.id) {
        // ✅ Allowed
      } else {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to reply to this personal ticket'
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const newReply = await tx.supportTicketReply.create({
        data: {
          ticketId: id,
          message,
          isInternal,
          sentBy,
          sentByName: sentBy
        }
      });

      let newStatus = ticket.status;
      if (ticket.status === 'RESOLVED' || ticket.status === 'WAITING_FOR_CLIENT') {
        newStatus = 'OPEN';
      }

      const updatedTicket = await tx.supportTicket.update({
        where: { id },
        data: {
          status: newStatus,
          updatedAt: new Date(),
          ...(ticket.firstRespondedAt === null && !isInternal && sentBy !== ticket.openedBy ? {
            firstRespondedAt: new Date()
          } : {})
        }
      });

      await tx.supportTicketEvent.create({
        data: {
          ticketId: id,
          eventType: isInternal ? 'INTERNAL_NOTE_ADDED' : 'REPLY_ADDED',
          actorId: sentBy,
          newValue: {
            messagePreview: message.substring(0, 100),
            isInternal
          }
        }
      });

      return { reply: newReply, ticket: updatedTicket };
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Reply error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to add reply'
    });
  }
});

// PATCH /api/support/tickets/:id/status
router.patch('/tickets/:id/status', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const validation = statusUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const { status: newStatus } = validation.data;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id, isDeleted: false }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    if (!isValidTransition(ticket.status, newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid transition: ${ticket.status} → ${newStatus}`
      });
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date()
      };

      if (newStatus === 'RESOLVED') {
        updateData.resolvedAt = new Date();
      }
      if (newStatus === 'CLOSED') {
        updateData.closedAt = new Date();
      }

      const updated = await tx.supportTicket.update({
        where: { id },
        data: updateData
      });

      await tx.supportTicketEvent.create({
        data: {
          ticketId: id,
          eventType: newStatus === 'RESOLVED' ? 'RESOLVED' :
                     newStatus === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
          actorId: 'system',
          oldValue: { status: ticket.status },
          newValue: { status: newStatus }
        }
      });

      return updated;
    });

    return res.json({
      success: true,
      data: updatedTicket
    });
  } catch (error: any) {
    console.error('Status update error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update status'
    });
  }
});

// PATCH /api/support/tickets/:id/assign
router.patch('/tickets/:id/assign', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const validation = assignSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const { assignedTo } = validation.data;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id, isDeleted: false }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      const eventType = ticket.assignedTo ? 'REASSIGNED' : 'ASSIGNED';

      const updated = await tx.supportTicket.update({
        where: { id },
        data: {
          assignedTo,
          assignedBy: 'system',
          assignedAt: new Date(),
          previousAssignee: ticket.assignedTo
        }
      });

      await tx.supportTicketEvent.create({
        data: {
          ticketId: id,
          eventType,
          actorId: 'system',
          oldValue: { assignedTo: ticket.assignedTo },
          newValue: { assignedTo }
        }
      });

      return updated;
    });

    return res.json({
      success: true,
      data: updatedTicket
    });
  } catch (error: any) {
    console.error('Assign error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to assign ticket'
    });
  }
});

// PATCH /api/support/tickets/:id/escalate
router.patch('/tickets/:id/escalate', async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const validation = escalateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const { escalationReason } = validation.data;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id, isDeleted: false }
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const ownerId = 'owner_user_id_placeholder';

    const updatedTicket = await prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id },
        data: {
          assignedTo: ownerId,
          previousAssignee: ticket.assignedTo,
          escalatedAt: new Date(),
          escalatedBy: 'system',
          escalationReason
        }
      });

      await tx.supportTicketEvent.create({
        data: {
          ticketId: id,
          eventType: 'ESCALATED',
          actorId: 'system',
          oldValue: { assignedTo: ticket.assignedTo },
          newValue: { assignedTo: ownerId, escalationReason }
        }
      });

      return updated;
    });

    return res.json({
      success: true,
      data: updatedTicket
    });
  } catch (error: any) {
    console.error('Escalate error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to escalate ticket'
    });
  }
});

export default router;