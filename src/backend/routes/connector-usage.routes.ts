import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────
const syncSchema = z.object({
  connectorCode: z.string().min(1),
  periodStart:   z.string().datetime(),
  periodEnd:     z.string().datetime(),
  usageCount:    z.number().int().nonnegative(),
  usageUnit:     z.string().min(1),
  syncSource:    z.string().min(1),
});

// ─── POST /api/connector-usage/sync ───────────────────────────────────
// Append-only. Writes one connector_usage row per sync call.
// unitPrice and pricingVersion are read from connector_catalog at
// write time and frozen into the row. billableAmount is computed
// server-side.
//
// organizationId comes from the JWT. Never from the body.
//
// Also creates a boundary_proof_logs row with
// eventType = 'CONNECTOR_USAGE_SYNC' and debtorDataIncluded = false.
router.post('/sync', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }

    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues?.[0]?.message || 'Validation failed',
      });
    }

    const { connectorCode, periodStart, periodEnd, usageCount, usageUnit, syncSource } = parsed.data;
    const organizationId = user.organizationId;

    // Look up the connector to freeze pricing at write time.
    const catalog = await prisma.connectorCatalog.findUnique({
      where: { code: connectorCode },
    });
    if (!catalog) {
      return res.status(404).json({ success: false, error: 'Unknown connector' });
    }

    // Extract pricing details. pricingConfig is free-form Json, so
    // we defensively read currency and markupPercent if present.
    const cfg = (catalog.pricingConfig as any) || {};
    const currency = typeof cfg.currency === 'string' ? cfg.currency : 'USD';
    const markupPercent = typeof cfg.markupPercent === 'number' ? cfg.markupPercent : 0;

    // For Phase 14.3 we do not have live provider pricing. unitPrice
    // is taken from an optional cfg.unitPrice if present, else 0.
    // Real provider pricing integration is a later step.
    const baseUnitPrice = typeof cfg.unitPrice === 'number' ? cfg.unitPrice : 0;
    const effectiveUnitPrice = baseUnitPrice * (1 + markupPercent / 100);
    const pricingVersion = typeof cfg.pricingVersion === 'string'
      ? cfg.pricingVersion
      : 'v1';
    const billableAmount = effectiveUnitPrice * usageCount;

    const result = await prisma.$transaction(async (tx) => {
      const usage = await tx.connectorUsage.create({
        data: {
          organizationId,
          connectorCode,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          usageCount,
          usageUnit,
          unitPrice: effectiveUnitPrice,
          pricingVersion,
          billableAmount,
          currency,
          syncSource,
        },
      });

      const proof = await tx.boundaryProofLog.create({
        data: {
          organizationId,
          eventType: 'CONNECTOR_USAGE_SYNC',
          payloadSummary: {
            connectorCode,
            periodStart,
            periodEnd,
            usageCount,
            usageUnit,
          },
          debtorDataIncluded: false,
        },
      });

      return { usage, proof };
    });

    return res.status(200).json({
      success: true,
      data: {
        id: result.usage.id,
        organizationId: result.usage.organizationId,
        connectorCode: result.usage.connectorCode,
        periodStart: result.usage.periodStart,
        periodEnd: result.usage.periodEnd,
        usageCount: result.usage.usageCount,
        usageUnit: result.usage.usageUnit,
        unitPrice: result.usage.unitPrice,
        pricingVersion: result.usage.pricingVersion,
        billableAmount: result.usage.billableAmount,
        currency: result.usage.currency,
        syncSource: result.usage.syncSource,
        reportedAt: result.usage.reportedAt,
        boundaryProofLogId: result.proof.id,
      },
    });
  } catch (error) {
    console.error('❌ Connector usage sync error:', error);
    return res.status(500).json({ success: false, error: 'Connector usage sync failed' });
  }
});

// ─── GET /api/connector-usage ─────────────────────────────────────────
// Returns connector_usage rows.
//   OWNER  -> all organizations, optional ?organizationId filter
//   Others -> own organization only
// Optional query params: connectorCode, from, to, limit, offset.
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const isOwner = user.role === 'OWNER';
    if (!isOwner && !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }

    const {
      organizationId: filterOrgId,
      connectorCode,
      from,
      to,
      limit: rawLimit,
      offset: rawOffset,
    } = req.query as Record<string, string | undefined>;

    const limit = Math.min(Math.max(parseInt(rawLimit || '100', 10) || 100, 1), 500);
    const offset = Math.max(parseInt(rawOffset || '0', 10) || 0, 0);

    const where: any = {};
    if (isOwner) {
      if (filterOrgId) where.organizationId = filterOrgId;
    } else {
      where.organizationId = user.organizationId;
    }

    if (connectorCode) where.connectorCode = connectorCode;
    if (from || to) {
      where.periodStart = {};
      if (from) where.periodStart.gte = new Date(from);
      if (to) where.periodStart.lte = new Date(to);
    }

    const [rows, total] = await Promise.all([
      prisma.connectorUsage.findMany({
        where,
        orderBy: { reportedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.connectorUsage.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: { rows, total, limit, offset },
    });
  } catch (error) {
    console.error('❌ Connector usage read error:', error);
    return res.status(500).json({ success: false, error: 'Failed to read connector usage' });
  }
});

export default router;