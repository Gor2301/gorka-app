import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────
const enableSchema = z.object({
  connectorCode: z.string().min(1),
  credentialsLocation: z.enum(['CLOUD', 'LOCAL']),
  zone3Acknowledged: z.boolean().optional(),
  tier1Acknowledged: z.boolean().optional(),
});

const disableSchema = z.object({
  connectorCode: z.string().min(1),
});

// ─── GORKA Tier 1 credential lookup ───────────────────────────────────
// Reads GORKA's own provider credentials from environment variables.
// Returns null when no GORKA credential is configured for the code.
//
// The credential is returned to the caller in the enable response body.
// It is held in process memory for the duration of the request only.
// It is never persisted, logged, or written to the database. See
// SLICE-5-SPEC §5 (SECURITY NOTE) and CONNECTOR-MODEL.md §4.5.
//
// Encoding: `value` is the provider credential as a UTF-8 string. The
// client re-encodes it to bytes before calling
// write_local_connector_credential. `configuration` is JSON.
function getGorkaCredential(
  connectorCode: string
): { value: string; configuration: Record<string, any> } | null {
  switch (connectorCode) {
    case 'resend-email': {
      const apiKey = process.env.GORKA_RESEND_API_KEY;
      const from = process.env.GORKA_RESEND_FROM;
      if (!apiKey || !from) return null;
      return { value: apiKey, configuration: { from } };
    }
    case 'twilio-sms': {
      const accountSid = process.env.GORKA_TWILIO_ACCOUNT_SID;
      const authToken = process.env.GORKA_TWILIO_AUTH_TOKEN;
      const from = process.env.GORKA_TWILIO_FROM;
      if (!accountSid || !authToken || !from) return null;
      return {
        value: JSON.stringify({ accountSid, authToken }),
        configuration: { from },
      };
    }
    default:
      return null;
  }
}

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
//
// Slice 5: when tier1Acknowledged === true and the backend holds a
// GORKA credential for the requested code, the response body gains a
// `credential` field. The field is omitted otherwise. The credential
// is never persisted, logged, or written to the database.
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

     const { connectorCode, credentialsLocation, zone3Acknowledged, tier1Acknowledged } = parsed.data;

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

    const row = await prisma.$transaction(async (tx) => {
      const upserted = await tx.clientConnector.upsert({
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

      if (zone3Acknowledged === true) {
        await tx.organizationAuditEvent.create({
          data: {
            organizationId: user.organizationId,
            eventType: 'ZONE_3_CONNECTION_ACKNOWLEDGED',
            actorId: user.id,
            actorName: user.email ?? null,
            details: { connectorCode, tier: 'TIER2' },
          },
        });
      }

      if (tier1Acknowledged === true) {
        await tx.organizationAuditEvent.create({
          data: {
            organizationId: user.organizationId,
            eventType: 'TIER1_CONNECTION_ACKNOWLEDGED',
            actorId: user.id,
            actorName: user.email ?? null,
            details: { connectorCode, tier: 'TIER1' },
          },
        });
      }
      return upserted;
    });

    const responseBody: {
      success: boolean;
      data: unknown;
      credential?: { value: string; configuration: Record<string, any> };
    } = { success: true, data: row };

    if (tier1Acknowledged === true) {
      const gorkaCredential = getGorkaCredential(connectorCode);
      if (gorkaCredential) {
        responseBody.credential = gorkaCredential;
      }
    }

    return res.status(200).json(responseBody);
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

// GET /api/connectors/catalog
// Returns the active connector_catalog rows for display.
router.get('/catalog', async (req: Request, res: Response): Promise<any> => {
  try {
    const rows = await prisma.connectorCatalog.findMany({
      where: { isActive: true, lifecycleStatus: 'ACTIVE' },
      orderBy: { code: 'asc' },
    });
    return res.status(200).json({ success: true, data: { rows, total: rows.length } });
  } catch (error) {
    console.error('Connector catalog error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list catalog' });
  }
});
export default router;