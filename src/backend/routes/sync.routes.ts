import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// -----------------------------------------------------------------
// In-memory ephemeral endpoint registry.
//
// Keyed by "<organizationId>:<wireDeviceId>".
// Holds only: organizationId, wireDeviceId, userId, listenAddress,
// lastSeenAt. No debtor data. No persistent state. Lost on backend
// restart; peers re-register on their next heartbeat.
//
// This is the mechanism by which one peer learns another peer's
// current network address. It is not a source of identity.
// wireDeviceId remains the device identity established by the
// sync protocol.
// -----------------------------------------------------------------

const ENDPOINT_TTL_MS = 30_000;

interface EndpointEntry {
  organizationId: string;
  wireDeviceId: string;
  userId: string;
  listenAddress: string;
  lastSeenAt: number;
}

const registry = new Map<string, EndpointEntry>();

function keyOf(organizationId: string, wireDeviceId: string): string {
  return organizationId + ':' + wireDeviceId;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [k, entry] of registry) {
    if (now - entry.lastSeenAt > ENDPOINT_TTL_MS) {
      registry.delete(k);
    }
  }
}

function isWireDeviceId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64;
}

function isListenAddress(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 255;
}

// -----------------------------------------------------------------
// POST /api/sync/register-endpoint
//
// Body: { wireDeviceId: string, listenAddress: string }
//
// Registers or refreshes this device's endpoint in the registry,
// and upserts a device_registrations row using only the authorized
// columns. No reserved column is read or written.
// -----------------------------------------------------------------
router.post('/register-endpoint', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }
    const { wireDeviceId, listenAddress } = req.body || {};
    if (!isWireDeviceId(wireDeviceId) || !isListenAddress(listenAddress)) {
      return res
        .status(400)
        .json({ success: false, error: 'wireDeviceId and listenAddress are required' });
    }

    pruneExpired();
    registry.set(keyOf(user.organizationId, wireDeviceId), {
      organizationId: user.organizationId,
      wireDeviceId,
      userId: user.id,
      listenAddress,
      lastSeenAt: Date.now(),
    });

    // Persist the registration in device_registrations.
    // A failure here does not break discovery; it is logged and
    // the ephemeral registration stands.
    try {
      await prisma.deviceRegistration.upsert({
        where: {
          organizationId_userId: {
            organizationId: user.organizationId,
            userId: user.id,
          },
        },
        create: {
          organizationId: user.organizationId,
          userId: user.id,
          isAuthorized: true,
          lastSeenAt: new Date(),
        },
        update: {
          isAuthorized: true,
          lastSeenAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.error('register-endpoint device_registrations upsert failed:', dbErr);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('register-endpoint error:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// -----------------------------------------------------------------
// POST /api/sync/heartbeat
//
// Body: { wireDeviceId: string, listenAddress?: string }
//
// Refreshes lastSeenAt in both the ephemeral registry and the
// persistent device_registrations row. If the endpoint is unknown
// and a listenAddress is provided, it is treated as a registration.
// -----------------------------------------------------------------
router.post('/heartbeat', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }
    const { wireDeviceId, listenAddress } = req.body || {};
    if (!isWireDeviceId(wireDeviceId)) {
      return res.status(400).json({ success: false, error: 'wireDeviceId is required' });
    }

    pruneExpired();
    const k = keyOf(user.organizationId, wireDeviceId);
    const existing = registry.get(k);
    if (existing) {
      existing.lastSeenAt = Date.now();
      if (isListenAddress(listenAddress)) {
        existing.listenAddress = listenAddress;
      }
    } else {
      if (!isListenAddress(listenAddress)) {
        return res
          .status(400)
          .json({ success: false, error: 'listenAddress is required for a new registration' });
      }
      registry.set(k, {
        organizationId: user.organizationId,
        wireDeviceId,
        userId: user.id,
        listenAddress,
        lastSeenAt: Date.now(),
      });
    }

    try {
      await prisma.deviceRegistration.update({
        where: {
          organizationId_userId: {
            organizationId: user.organizationId,
            userId: user.id,
          },
        },
        data: { lastSeenAt: new Date() },
      });
    } catch (dbErr) {
      // The row may not exist yet; heartbeat tolerates that.
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('heartbeat error:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// -----------------------------------------------------------------
// GET /api/sync/peers?wireDeviceId=<caller>
//
// Returns active peers in the same organization, excluding the
// caller. Only entries younger than ENDPOINT_TTL_MS are returned.
// -----------------------------------------------------------------
router.get('/peers', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }
    const callerWireDeviceId = (req.query.wireDeviceId as string) || '';

    pruneExpired();
    const now = Date.now();
    const peers: Array<{ wireDeviceId: string; listenAddress: string; lastSeenAt: string }> = [];
    for (const entry of registry.values()) {
      if (entry.organizationId !== user.organizationId) continue;
      if (entry.wireDeviceId === callerWireDeviceId) continue;
      if (now - entry.lastSeenAt > ENDPOINT_TTL_MS) continue;
      peers.push({
        wireDeviceId: entry.wireDeviceId,
        listenAddress: entry.listenAddress,
        lastSeenAt: new Date(entry.lastSeenAt).toISOString(),
      });
    }

    return res.status(200).json({ success: true, data: { peers } });
  } catch (error) {
    console.error('peers error:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// -----------------------------------------------------------------
// POST /api/sync/unregister-endpoint
//
// Body: { wireDeviceId: string }
//
// Removes the endpoint from the ephemeral registry. Called on
// graceful engine shutdown.
// -----------------------------------------------------------------
router.post('/unregister-endpoint', async (req: Request, res: Response): Promise<any> => {
  try {
    const user = (req as any).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({ success: false, error: 'No organization context' });
    }
    const { wireDeviceId } = req.body || {};
    if (!isWireDeviceId(wireDeviceId)) {
      return res.status(400).json({ success: false, error: 'wireDeviceId is required' });
    }

    registry.delete(keyOf(user.organizationId, wireDeviceId));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('unregister-endpoint error:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;