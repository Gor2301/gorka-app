// src/backend/relay.service.ts
//
// Encrypted relay for the GORKA sync protocol.
//
// Two client-owned peers that cannot establish a direct TCP
// connection connect here over WebSocket. The relay pairs them and
// forwards opaque binary frames between them.
//
// The relay:
//   - cannot decrypt (it holds no organization key, no session key);
//   - never inspects binary payloads;
//   - never persists payload bytes;
//   - never logs JWTs or ciphertext;
//   - creates exactly one relay_sessions row per paired connection;
//   - canonicalizes deviceAId / deviceBId by lexicographic order.
//
// It is a pipe. Nothing more.
//
// The two identities in play:
//   wireDeviceId            ephemeral pairing handle, from the
//                           sync protocol (not persisted here)
//   DeviceRegistration.id   persistent DB identity, used only as
//                           the FK target in relay_sessions
//
// Do not substitute one for the other.

import { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { prisma } from './db';

interface OpenFrame {
  type: 'open';
  jwt: string;
  wireDeviceId: string;
  targetWireDeviceId?: string;
}

interface PeerContext {
  ws: WebSocket;
  organizationId: string;
  userId: string;
  wireDeviceId: string;
  targetWireDeviceId: string | null;
  deviceRegistrationId: string | null;
  peer: PeerContext | null;
  relaySessionId: string | null;
  bytesForwarded: bigint;
}

const activeConnections = new Map<string, PeerContext>();

function keyOf(organizationId: string, wireDeviceId: string): string {
  return organizationId + ':' + wireDeviceId;
}

function isOpenFrame(v: any): v is OpenFrame {
  return (
    v &&
    v.type === 'open' &&
    typeof v.jwt === 'string' &&
    typeof v.wireDeviceId === 'string' &&
    v.wireDeviceId.length > 0 &&
    v.wireDeviceId.length <= 64 &&
    (v.targetWireDeviceId === undefined ||
      (typeof v.targetWireDeviceId === 'string' &&
        v.targetWireDeviceId.length > 0 &&
        v.targetWireDeviceId.length <= 64))
  );
}

// -----------------------------------------------------------------
// attachRelay
//
// Attaches a WebSocketServer to the existing HTTP server. Called
// once from index.ts after app.listen().
// -----------------------------------------------------------------
export function attachRelay(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/api/sync/relay' });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let ctx: PeerContext | null = null;

    ws.on('message', async (data, isBinary) => {
      // First frame: the "open" handshake.
      if (!ctx) {
        if (isBinary) {
          ws.close(1008, 'protocol: first frame must be text');
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(data.toString('utf8'));
        } catch {
          ws.close(1008, 'protocol: first frame is not JSON');
          return;
        }
        if (!isOpenFrame(parsed)) {
          ws.close(1008, 'protocol: malformed open frame');
          return;
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
          ws.close(1011, 'internal: JWT_SECRET not set');
          return;
        }
        let decoded: any;
        try {
          decoded = jwt.verify(parsed.jwt, secret);
        } catch {
          ws.close(1008, 'auth: invalid token');
          return;
        }
        const organizationId = decoded.organizationId;
        const userId = decoded.userId || decoded.id;
        if (typeof organizationId !== 'string' || typeof userId !== 'string') {
          ws.close(1008, 'auth: missing claims');
          return;
        }

        let registration;
        try {
          registration = await prisma.deviceRegistration.findUnique({
            where: {
              organizationId_userId: { organizationId, userId },
            },
          });
        } catch {
          ws.close(1011, 'internal: registration lookup failed');
          return;
        }
        if (!registration || !registration.isAuthorized) {
          ws.close(1008, 'auth: not registered');
          return;
        }

        const k = keyOf(organizationId, parsed.wireDeviceId);
        const existing = activeConnections.get(k);
        if (
          existing &&
          existing.ws !== ws &&
          existing.ws.readyState === WebSocket.OPEN
        ) {
          ws.close(1008, 'conflict: device already connected');
          return;
        }

        ctx = {
          ws,
          organizationId,
          userId,
          wireDeviceId: parsed.wireDeviceId,
          targetWireDeviceId: parsed.targetWireDeviceId || null,
          deviceRegistrationId: registration.id,
          peer: null,
          relaySessionId: null,
          bytesForwarded: 0n,
        };
        activeConnections.set(k, ctx);

        // Attempt to pair immediately if the other side is here.
        await attemptPairing(ctx);

        try {
          ws.send(JSON.stringify({ type: 'open-ok' }));
        } catch {
          // Best-effort.
        }
        return;
      }

      // Subsequent frames.
      if (isBinary) {
        if (!ctx.peer || ctx.peer.ws.readyState !== WebSocket.OPEN) {
          // Not paired (or peer disconnected). Drop silently.
          return;
        }
        try {
          ctx.peer.ws.send(data, { binary: true });
          // Count bytes only after successful forward (invariant).
          ctx.bytesForwarded += BigInt((data as Buffer).length);
        } catch {
          await endSession(ctx, 'FAILED', 'forward-failed');
        }
        return;
      }

      // Text frame from an authenticated peer. Only "open" is
      // defined; anything else is ignored.
    });

    ws.on('close', async () => {
      if (ctx) {
        await endSession(ctx, 'ENDED', 'normal-close');
      }
    });

    ws.on('error', async () => {
      if (ctx) {
        await endSession(ctx, 'FAILED', 'transport-error');
      }
    });
  });
}

// -----------------------------------------------------------------
// attemptPairing
//
// Called when a peer opens. Pairs it with whichever side is here.
// Two shapes:
//   - The opener has a target: find that target in the map.
//   - The opener has no target: find any unpaired peer targeting
//     this wire device id.
//
// No relay_sessions row is created until both sides are paired.
// -----------------------------------------------------------------
async function attemptPairing(opener: PeerContext): Promise<void> {
  if (opener.peer) return;

  let other: PeerContext | null = null;

  if (opener.targetWireDeviceId) {
    const k = keyOf(opener.organizationId, opener.targetWireDeviceId);
    const candidate = activeConnections.get(k);
    if (candidate && !candidate.peer && candidate.ws !== opener.ws) {
      other = candidate;
    }
  } else {
    // Look for a peer that named this wire device id as its target.
    for (const candidate of activeConnections.values()) {
      if (candidate.organizationId !== opener.organizationId) continue;
      if (candidate.peer) continue;
      if (candidate.ws === opener.ws) continue;
      if (candidate.targetWireDeviceId === opener.wireDeviceId) {
        other = candidate;
        break;
      }
    }
  }

  if (!other) return;

  // Canonicalize deviceAId / deviceBId by lexicographic order of
  // the persistent DeviceRegistration ids.
  const aReg = opener.deviceRegistrationId;
  const bReg = other.deviceRegistrationId;
  if (!aReg || !bReg) return;
  const [deviceAId, deviceBId] = aReg < bReg ? [aReg, bReg] : [bReg, aReg];

  let session;
  try {
    session = await prisma.relaySession.create({
      data: {
        organizationId: opener.organizationId,
        deviceAId,
        deviceBId,
        sessionStatus: 'ACTIVE',
      },
    });
  } catch (err) {
    console.error('relay_sessions create failed:', (err as Error).message);
    return;
  }

  opener.peer = other;
  other.peer = opener;
  opener.relaySessionId = session.id;
  other.relaySessionId = session.id;

  try {
    opener.ws.send(JSON.stringify({ type: 'paired' }));
  } catch {
    // Ignore; transport errors are handled by the close/error path.
  }
  try {
    other.ws.send(JSON.stringify({ type: 'paired' }));
  } catch {
    // Ignore.
  }
}

// -----------------------------------------------------------------
// endSession
//
// Called on close or on forward failure. Updates exactly one
// relay_sessions row. Detaches both sides so a subsequent close
// on the other WebSocket does not double-update the row.
// -----------------------------------------------------------------
async function endSession(
  ctx: PeerContext,
  status: 'ENDED' | 'FAILED',
  reason: string,
): Promise<void> {
  const k = keyOf(ctx.organizationId, ctx.wireDeviceId);
  activeConnections.delete(k);

  const peer = ctx.peer;
  const sessionId = ctx.relaySessionId;

  // Detach to prevent double-update.
  ctx.peer = null;
  ctx.relaySessionId = null;
  if (peer) {
    peer.peer = null;
    peer.relaySessionId = null;
    activeConnections.delete(keyOf(peer.organizationId, peer.wireDeviceId));
  }

  if (!sessionId) return;

  const totalBytes = ctx.bytesForwarded + (peer ? peer.bytesForwarded : 0n);

  try {
    await prisma.relaySession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        bytesTransferred: totalBytes,
        sessionStatus: status,
        closeReason: reason,
      },
    });
  } catch (err) {
    console.error('relay_sessions update failed:', (err as Error).message);
  }

  if (peer && peer.ws.readyState === WebSocket.OPEN) {
    try {
      peer.ws.send(JSON.stringify({ type: 'peer-closed', reason }));
      peer.ws.close(1000, 'peer-closed');
    } catch {
      // Best-effort.
    }
  }
}