import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// ─── GET /api/boundary-proofs ─────────────────────────────────────────
// Returns boundary_proof_logs rows. Counts and aggregates only.
// No debtor identifiers exist in this table by design.
//
// Role handling:
//   - OWNER: sees all organizations' proof logs.
//   - Any other role: sees only their own organization.
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
      eventType,
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

    if (eventType) where.eventType = eventType;

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const [rows, total] = await Promise.all([
      prisma.boundaryProofLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.boundaryProofLog.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: { rows, total, limit, offset },
    });
  } catch (error) {
    console.error('❌ Boundary proof error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch boundary proof logs',
    });
  }
});

export default router;