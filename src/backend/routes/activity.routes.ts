import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── Validation ───────────────────────────────────────────────────────
// Counts only. No debtor identifiers accepted. No debtor fields exist
// in this payload by design (Architectural Law §4, §11; Data Boundary
// Matrix §10). organizationId is NOT accepted from the body — it is
// derived from the authenticated JWT (spec §4 Rule 3).
const syncSchema = z.object({
  periodStart:        z.string().datetime(),
  periodEnd:          z.string().datetime(),
  uploadsCount:       z.number().int().nonnegative(),
  uploadBatchAvgSize: z.number().int().nonnegative(),
  deletionsCount:     z.number().int().nonnegative(),
  actionsCreatedCount:z.number().int().nonnegative(),
  messagesSentCount:  z.number().int().nonnegative(),
  activeUsersCount:   z.number().int().nonnegative(),
  daysActive:         z.number().int().nonnegative(),
  syncEventsCount:    z.number().int().nonnegative(),
});

// ─── POST /api/activity/sync ──────────────────────────────────────────
router.post('/sync', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const result = syncSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues?.[0]?.message || 'Validation failed',
      });
    }

    const {
      periodStart,
      periodEnd,
      uploadsCount,
      uploadBatchAvgSize,
      deletionsCount,
      actionsCreatedCount,
      messagesSentCount,
      activeUsersCount,
      daysActive,
      syncEventsCount,
    } = result.data;

    const organizationId = user.organizationId;

    const [activity, proofLog] = await prisma.$transaction(async (tx) => {
      const a = await tx.clientActivityMetrics.create({
        data: {
          organizationId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          uploadsCount,
          uploadBatchAvgSize,
          deletionsCount,
          actionsCreatedCount,
          messagesSentCount,
          activeUsersCount,
          daysActive,
          syncEventsCount,
        },
      });

      const p = await tx.boundaryProofLog.create({
        data: {
          organizationId,
          eventType: 'ACTIVITY_SYNC',
          payloadSummary: {
            periodStart,
            periodEnd,
            uploadsCount,
            uploadBatchAvgSize,
            deletionsCount,
            actionsCreatedCount,
            messagesSentCount,
            activeUsersCount,
            daysActive,
            syncEventsCount,
          },
          debtorDataIncluded: false,
        },
      });

      return [a, p];
    });

    return res.status(200).json({
      success: true,
      data: {
        id: activity.id,
        organizationId: activity.organizationId,
        periodStart: activity.periodStart,
        periodEnd: activity.periodEnd,
        uploadsCount: activity.uploadsCount,
        uploadBatchAvgSize: activity.uploadBatchAvgSize,
        deletionsCount: activity.deletionsCount,
        actionsCreatedCount: activity.actionsCreatedCount,
        messagesSentCount: activity.messagesSentCount,
        activeUsersCount: activity.activeUsersCount,
        daysActive: activity.daysActive,
        syncEventsCount: activity.syncEventsCount,
        createdAt: activity.createdAt,
        boundaryProofLogId: proofLog.id,
      },
    });
  } catch (error) {
    console.error('❌ Activity sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'Activity sync failed',
    });
  }
});

export default router;