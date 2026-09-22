import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────
const enableSchema = z.object({
  connectorCode: z.string().min(1),
  credentialsLocation: z.enum(['CLOUD', 'LOCAL']),
});

const disableSchema = z.object({
  connectorCode: z.string().min(1),
});

// ─── GET /api/connectors ──────────────────────────────────────────────
// Returns the caller's enabled connectors.
//   OWNER  -> all organizations
//   Others -> own organization only
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const isOwner = user.role === 'OWNER';
    const where: any = {};
    if (!isOwner) {
      if (!user.organizationId) {
        return res.status(403).json({ success: false, error: 'No organization context' });
      }
      where.organizationId = user.organizationId;
    }

    const rows = await prisma.clientConnector.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: { rows, total: rows.length } });
  } catch (error) {
    console.error('❌ Connector list error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list connectors' });
  }
});

// ─── POST /api/connectors/enable ──────────────────────────────────────
// Enables a connector for the caller's organization.
// LOCAL credentialsLocation only in this phase. CLOUD is rejected
// until credential encryption is implemented.
router.post('/enable', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }

    const parsed = enableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues?.[0]?.message || 'Validation failed',
      });
    }

    const { connectorCode, credentialsLocation } = parsed.data;

    if (credentialsLocation === 'CLOUD') {
      return res.status(400).json({
        success: false,
        error: 'CLOUD credentials not yet available. Use LOCAL (bring your own credentials).',
      });
    }

    // Confirm the connector exists and is ACTIVE in the catalog.
    const catalog = await prisma.connectorCatalog.findUnique({
      where: { code: connectorCode },
    });
    if (!catalog) {
      return res.status(404).json({ success: false, error: 'Unknown connector' });
    }
    if (!catalog.isActive || catalog.lifecycleStatus !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: `Connector not available (status: ${catalog.lifecycleStatus})`,
      });
    }

    const row = await prisma.clientConnector.upsert({
      where: {
        organizationId_connectorCode: {
          organizationId: user.organizationId,
          connectorCode,
        },
      },
      create: {
        organizationId: user.organizationId,
        connectorCode,
        status: 'CONNECTED',
        credentialsLocation,
        connectedAt: new Date(),
      },
      update: {
        status: 'CONNECTED',
        credentialsLocation,
        connectedAt: new Date(),
        disconnectedAt: null,
        suspendedReason: null,
      },
    });

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error('❌ Connector enable error:', error);
    return res.status(500).json({ success: false, error: 'Failed to enable connector' });
  }
});

// ─── POST /api/connectors/disable ─────────────────────────────────────
// Disables a connector for the caller's organization. If the row
// does not exist, returns 404.
router.post('/disable', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }

    const parsed = disableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues?.[0]?.message || 'Validation failed',
      });
    }

    const { connectorCode } = parsed.data;

    const existing = await prisma.clientConnector.findUnique({
      where: {
        organizationId_connectorCode: {
          organizationId: user.organizationId,
          connectorCode,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Connector not enabled for this organization',
      });
    }

    const row = await prisma.clientConnector.update({
      where: { id: existing.id },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
      },
    });

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error('❌ Connector disable error:', error);
    return res.status(500).json({ success: false, error: 'Failed to disable connector' });
  }
});

export default router;