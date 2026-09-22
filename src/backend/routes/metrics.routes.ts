import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── Validation ───────────────────────────────────────────────────────
// Numbers only. No debtor identifiers accepted. No debtor fields exist
// in this payload by design (Architectural Law §4, §11; Data Boundary
// Matrix §9). organizationId is NOT accepted from the body — it is
// derived from the authenticated JWT (spec §4 Rule 3).
const syncSchema = z.object({
  debtorCount:     z.number().int().nonnegative(),
  totalDebt:       z.number().nonnegative(),
  agentCount:      z.number().int().nonnegative(),
  activeCaseCount: z.number().int().nonnegative(),
});

// ─── POST /api/metrics/sync ───────────────────────────────────────────
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

    const { debtorCount, totalDebt, agentCount, activeCaseCount } = result.data;
    const organizationId = user.organizationId;

    const now = new Date();

    const [metrics, proofLog] = await prisma.$transaction(async (tx) => {
      const m = await tx.aggregateMetrics.upsert({
        where: { organizationId },
        create: {
          organizationId,
          debtorCount,
          totalDebt,
          agentCount,
          activeCaseCount,
          lastSyncedAt: now,
        },
        update: {
          debtorCount,
          totalDebt,
          agentCount,
          activeCaseCount,
          lastSyncedAt: now,
        },
      });

      const p = await tx.boundaryProofLog.create({
        data: {
          organizationId,
          eventType: 'METRICS_SYNC',
          payloadSummary: {
            debtorCount,
            totalDebt,
            agentCount,
            activeCaseCount,
          },
          debtorDataIncluded: false,
        },
      });

      return [m, p];
    });

    return res.status(200).json({
      success: true,
      data: {
        organizationId: metrics.organizationId,
        debtorCount: metrics.debtorCount,
        totalDebt: metrics.totalDebt,
        agentCount: metrics.agentCount,
        activeCaseCount: metrics.activeCaseCount,
        lastSyncedAt: metrics.lastSyncedAt,
        boundaryProofLogId: proofLog.id,
      },
    });
  } catch (error) {
    console.error('❌ Metrics sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'Metrics sync failed',
    });
  }
});

export default router;