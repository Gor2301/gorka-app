import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// ─── GET /api/billing/summary ─────────────────────────────────────────
// Aggregates connector_usage rows per connector for a requested period.
//
// Role scoping:
//   OWNER  -> all organizations; optional ?organizationId filter
//   Others -> own organization only
//
// Query params:
//   organizationId  (OWNER only)
//   from            (ISO date, filters periodStart >= from)
//   to              (ISO date, filters periodEnd <= to)
//
// Response:
//   { organizationId, periodStart, periodEnd, connectors: [...],
//     totals: { usageTotal, billableTotal, currency } }
router.get('/summary', async (req: Request, res: Response): Promise<any> => {
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
      from,
      to,
    } = req.query as Record<string, string | undefined>;

    const where: any = {};
    if (isOwner) {
      if (filterOrgId) where.organizationId = filterOrgId;
    } else {
      where.organizationId = user.organizationId;
    }

    if (from || to) {
      where.periodStart = {};
      if (from) where.periodStart.gte = new Date(from);
      if (to) where.periodStart.lte = new Date(to);
    }

    const rows = await prisma.connectorUsage.findMany({ where });

    // Group by connectorCode. Sum usageCount and billableAmount.
    // Currency is assumed consistent per connector for the prototype.
    const grouped = new Map<string, {
      connectorCode: string;
      usageUnit: string | null;
      usageTotal: number;
      billableTotal: number;
      currency: string;
      rows: number;
    }>();

    for (const r of rows) {
      const key = r.connectorCode;
      const cur = grouped.get(key) || {
        connectorCode: key,
        usageUnit: r.usageUnit,
        usageTotal: 0,
        billableTotal: 0,
        currency: r.currency || 'USD',
        rows: 0,
      };
      cur.usageTotal += r.usageCount;
      cur.billableTotal += r.billableAmount;
      cur.rows += 1;
      grouped.set(key, cur);
    }

    const connectors = Array.from(grouped.values()).sort((a, b) =>
      a.connectorCode.localeCompare(b.connectorCode)
    );

    const totals = {
      usageTotal: connectors.reduce((s, c) => s + c.usageTotal, 0),
      billableTotal: connectors.reduce((s, c) => s + c.billableTotal, 0),
      currency: connectors[0]?.currency || 'USD',
    };

    return res.status(200).json({
      success: true,
      data: {
        organizationId: isOwner && filterOrgId ? filterOrgId : user.organizationId || null,
        from: from || null,
        to: to || null,
        connectors,
        totals,
      },
    });
  } catch (error) {
    console.error('❌ Billing summary error:', error);
    return res.status(500).json({ success: false, error: 'Failed to compute billing summary' });
  }
});

export default router;