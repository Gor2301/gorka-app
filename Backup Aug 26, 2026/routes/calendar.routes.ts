import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';

const router = Router();

// Test route - for debugging (no auth)
router.get('/test', (req, res) => {
  res.json({ message: 'Calendar route is working!', timestamp: new Date().toISOString() });
});

// Test route with authentication - for debugging
router.get('/test-auth', authenticateToken, requireTenant, (req: any, res) => {
  res.json({ 
    message: 'Auth works!', 
    user: req.user,
    organizationId: (req as any).organizationId
  });
});

// Test route with auth only (no tenant) - for debugging
router.get('/test-auth-only', authenticateToken, (req: any, res) => {
  res.json({ 
    message: 'Auth only works!', 
    user: req.user
  });
});

const prisma = new PrismaClient();

// ==================== GET CALENDAR EVENTS ====================
router.get('/events', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = (req as any).organizationId;
    const { startDate, endDate } = req.query;

    const where: any = { organizationId };

    if (startDate) {
      where.startDate = { gte: new Date(startDate as string) };
    }
    if (endDate) {
      where.endDate = { lte: new Date(endDate as string) };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        debtor: {
          select: { name: true, email: true }
        }
      }
    });

    return res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error: any) {
    console.error('Get calendar events error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch calendar events'
    });
  }
});

// ==================== CREATE CALENDAR EVENT ====================
router.post('/events', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = (req as any).organizationId;
    const userId = req.user.id;
    const { title, description, startDate, endDate, allDay, eventType, debtorId, sourceDate } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date is required'
      });
    }

    if (!endDate) {
      return res.status(400).json({
        success: false,
        error: 'End date is required'
      });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        allDay: allDay || false,
        eventType: eventType || 'MANUAL',
        debtorId: debtorId || null,
        sourceDate: sourceDate ? new Date(sourceDate) : null,
        organizationId,
        createdBy: userId
      },
      include: {
        debtor: {
          select: { name: true, email: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'CREATE',
        entityType: 'CALENDAR_EVENT',
        entityId: event.id,
        details: { title, eventType }
      }
    });

    return res.status(201).json({
      success: true,
      data: event
    });
  } catch (error: any) {
    console.error('Create calendar event error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create calendar event'
    });
  }
});

// ==================== UPDATE CALENDAR EVENT ====================
router.put('/:id', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).organizationId;
    const userId = req.user.id;
    const { title, description, startDate, endDate, allDay, eventType, debtorId } = req.body;

    // Check if event exists
    const existing = await prisma.calendarEvent.findFirst({
      where: { id, organizationId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: title || existing.title,
        description: description !== undefined ? description : existing.description,
        startDate: startDate ? new Date(startDate) : existing.startDate,
        endDate: endDate ? new Date(endDate) : existing.endDate,
        allDay: allDay !== undefined ? allDay : existing.allDay,
        eventType: eventType || existing.eventType,
        debtorId: debtorId !== undefined ? debtorId : existing.debtorId
      },
      include: {
        debtor: {
          select: { name: true, email: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'UPDATE',
        entityType: 'CALENDAR_EVENT',
        entityId: event.id,
        details: { title }
      }
    });

    return res.json({
      success: true,
      data: event
    });
  } catch (error: any) {
    console.error('Update calendar event error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update calendar event'
    });
  }
});

// ==================== DELETE CALENDAR EVENT ====================
router.delete('/:id', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).organizationId;
    const userId = req.user.id;

    // Check if event exists
    const existing = await prisma.calendarEvent.findFirst({
      where: { id, organizationId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    await prisma.calendarEvent.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'DELETE',
        entityType: 'CALENDAR_EVENT',
        entityId: id,
        details: { title: existing.title }
      }
    });

    return res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete calendar event error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete calendar event'
    });
  }
});

// ==================== GENERATE AUTO-EVENTS ====================
router.post('/generate', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = (req as any).organizationId;
    const userId = req.user.id;

    // Find debtors with payment or follow-up dates
    const debtors = await prisma.debtor.findMany({
      where: {
        organizationId,
        OR: [
          { nextPaymentDate: { not: null } },
          { nextFollowUpDate: { not: null } }
        ]
      }
    });

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const debtor of debtors) {
      // Generate payment due events
      if (debtor.nextPaymentDate) {
        try {
          await prisma.calendarEvent.upsert({
            where: {
              organizationId_eventType_debtorId_sourceDate: {
                organizationId,
                eventType: 'PAYMENT_DUE',
                debtorId: debtor.id,
                sourceDate: debtor.nextPaymentDate
              }
            },
            update: {
              title: `Payment Due: ${debtor.name}`,
              description: `Payment of $${debtor.totalDebt?.toFixed(2) || '0'} due`,
              startDate: debtor.nextPaymentDate,
              endDate: debtor.nextPaymentDate,
              allDay: true
            },
            create: {
              title: `Payment Due: ${debtor.name}`,
              description: `Payment of $${debtor.totalDebt?.toFixed(2) || '0'} due`,
              startDate: debtor.nextPaymentDate,
              endDate: debtor.nextPaymentDate,
              allDay: true,
              eventType: 'PAYMENT_DUE',
              debtorId: debtor.id,
              sourceDate: debtor.nextPaymentDate,
              organizationId,
              createdBy: userId
            }
          });
          updated++;
        } catch (err) {
          errors++;
        }
      }

      // Generate follow-up events
      if (debtor.nextFollowUpDate) {
        try {
          await prisma.calendarEvent.upsert({
            where: {
              organizationId_eventType_debtorId_sourceDate: {
                organizationId,
                eventType: 'FOLLOW_UP',
                debtorId: debtor.id,
                sourceDate: debtor.nextFollowUpDate
              }
            },
            update: {
              title: `Follow-up: ${debtor.name}`,
              description: `Follow-up required for ${debtor.name}`,
              startDate: debtor.nextFollowUpDate,
              endDate: debtor.nextFollowUpDate,
              allDay: true
            },
            create: {
              title: `Follow-up: ${debtor.name}`,
              description: `Follow-up required for ${debtor.name}`,
              startDate: debtor.nextFollowUpDate,
              endDate: debtor.nextFollowUpDate,
              allDay: true,
              eventType: 'FOLLOW_UP',
              debtorId: debtor.id,
              sourceDate: debtor.nextFollowUpDate,
              organizationId,
              createdBy: userId
            }
          });
          updated++;
        } catch (err) {
          errors++;
        }
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'GENERATE',
        entityType: 'CALENDAR_EVENT',
        details: { created, updated, errors, debtorsProcessed: debtors.length }
      }
    });

    return res.json({
      success: true,
      data: {
        debtorsProcessed: debtors.length,
        created,
        updated,
        errors
      }
    });
  } catch (error: any) {
    console.error('Generate calendar events error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate calendar events'
    });
  }
});

export default router;