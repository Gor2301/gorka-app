import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../db';

const router = Router();

// --- Validation ---
const inviteAgentSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  tempPassword: z.string().min(8),
});

// --- Helpers ---
// Inline role gate. No shared middleware exists for OWNER/CLIENT today.
// See CONNECTOR-EVENT-ORDER-SPEC Part IV, IV.6 item 5.
function requireOwnerOrClient(req: Request, res: Response): boolean {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return false;
  }
  if (user.role !== 'OWNER' && user.role !== 'CLIENT') {
    res.status(403).json({ success: false, error: 'Insufficient role' });
    return false;
  }
  if (!user.organizationId) {
    res.status(403).json({ success: false, error: 'No organization context' });
    return false;
  }
  return true;
}

// --- POST /api/users/invite-agent ---
// Creates an AGENT user scoped to the caller's organization.
// The temp password is delivered out of band; it is never emailed.
router.post('/invite-agent', async (req: Request, res: Response) => {
  try {
    if (!requireOwnerOrClient(req, res)) return;

    const parsed = inviteAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: parsed.error.flatten(),
      });
    }

    const { email, name, tempPassword } = parsed.data;
    const organizationId = (req as any).user.organizationId as string;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const created = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
        role: 'AGENT',
        isActive: true,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    console.error('[USERS] invite-agent failed:', error.message);
    return res
      .status(500)
      .json({ success: false, error: 'Failed to create agent user' });
  }
});

// --- GET /api/users ---
// Lists users in the caller's organization. Never returns passwordHash.
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!requireOwnerOrClient(req, res)) return;

    const organizationId = (req as any).user.organizationId as string;

    const rows = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({ success: true, data: rows });
  } catch (error: any) {
    console.error('[USERS] list failed:', error.message);
    return res
      .status(500)
      .json({ success: false, error: 'Failed to list users' });
  }
});

export default router;