import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────
const upsertSchema = z.object({
  organizationId:       z.string().min(1),
  type:                 z.enum(['FREE', 'PROFESSIONAL', 'ENTERPRISE']),
  status:               z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'CANCELLED']),
  expiresAt:            z.string().datetime(),
  renewalCycle:         z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  price:                z.number().nonnegative().optional(),
  currency:             z.string().min(1).max(8).optional(),
  stripeCustomerId:     z.string().nullable().optional(),
  stripeSubscriptionId: z.string().nullable().optional(),
  stripePriceId:        z.string().nullable().optional(),
});

const setPlanSchema = z.object({
  organizationId: z.string().min(1),
  type:           z.enum(['FREE', 'PROFESSIONAL', 'ENTERPRISE']),
  expiresAt:      z.string().datetime().optional(),
});

function ownerOnly(user: any): boolean {
  return user && user.role === 'OWNER';
}

// ─── GET /api/licenses/me ─────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }
    const row = await prisma.license.findFirst({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error('❌ License me error:', error);
    return res.status(500).json({ success: false, error: 'Failed to read license' });
  }
});

// ─── GET /api/licenses ────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!ownerOnly(user)) {
      return res.status(403).json({ success: false, error: 'OWNER only' });
    }
    const rows = await prisma.license.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: { rows, total: rows.length } });
  } catch (error) {
    console.error('❌ License list error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list licenses' });
  }
});

// ─── POST /api/licenses ───────────────────────────────────────────────
// OWNER only. Upsert by (organizationId, type). Because there is no
// unique constraint on that pair, we implement upsert as: find latest
// license for the org, update if exists, else create.
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!ownerOnly(user)) {
      return res.status(403).json({ success: false, error: 'OWNER only' });
    }

    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues?.[0]?.message || 'Validation failed',
      });
    }
    const data = parsed.data;

    // Confirm the organization exists.
    const org = await prisma.organization.findUnique({ where: { id: data.organizationId } });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Unknown organization' });
    }

    const existing = await prisma.license.findFirst({
      where: { organizationId: data.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const writeData = {
      organizationId:       data.organizationId,
      type:                 data.type,
      status:               data.status,
      expiresAt:            new Date(data.expiresAt),
      renewalCycle:         data.renewalCycle ?? existing?.renewalCycle ?? 'MONTHLY',
      price:                data.price ?? existing?.price ?? 0,
      currency:             data.currency ?? existing?.currency ?? 'USD',
      stripeCustomerId:     data.stripeCustomerId ?? existing?.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null,
      stripePriceId:        data.stripePriceId ?? existing?.stripePriceId ?? null,
    };

    const row = existing
      ? await prisma.license.update({ where: { id: existing.id }, data: writeData })
      : await prisma.license.create({ data: writeData });

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error('❌ License upsert error:', error);
    return res.status(500).json({ success: false, error: 'Failed to upsert license' });
  }
});

// ─── POST /api/licenses/set-plan ──────────────────────────────────────
// OWNER only. Sets a plan by tier using the default price from
// platform_settings. Discounts are applied by calling POST /api/licenses
// afterwards with an explicit price.
router.post('/set-plan', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!ownerOnly(user)) {
      return res.status(403).json({ success: false, error: 'OWNER only' });
    }

    const parsed = setPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues?.[0]?.message || 'Validation failed',
      });
    }
    const { organizationId, type, expiresAt } = parsed.data;

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return res.status(404).json({ success: false, error: 'Unknown organization' });
    }

    // Load plan defaults from platform_settings.
    const settings = await prisma.platformSettings.findUnique({ where: { key: 'plans' } });
    const tiers = (settings?.value as any)?.tiers || [];
    const tier = tiers.find((t: any) => t.tier === type);
    if (!tier) {
      return res.status(500).json({ success: false, error: `No default found for tier ${type}` });
    }

    const now = new Date();
    const fallbackExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
    const expiry = expiresAt ? new Date(expiresAt) : fallbackExpiry;

    const existing = await prisma.license.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const writeData = {
      organizationId,
      type,
      status: 'ACTIVE',
      expiresAt: expiry,
      renewalCycle: tier.renewalCycle || 'MONTHLY',
      price: typeof tier.price === 'number' ? tier.price : 0,
      currency: tier.currency || 'USD',
      stripeCustomerId:     existing?.stripeCustomerId ?? null,
      stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      stripePriceId:        existing?.stripePriceId ?? null,
    };

    const row = existing
      ? await prisma.license.update({ where: { id: existing.id }, data: writeData })
      : await prisma.license.create({ data: writeData });

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error('❌ License set-plan error:', error);
    return res.status(500).json({ success: false, error: 'Failed to set plan' });
  }
});

export default router;