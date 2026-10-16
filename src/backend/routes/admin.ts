import { Router, Request, Response } from 'express';
import { prisma } from '../db';

const router = Router();

// GET /api/admin/organizations
// Platform-wide organization list with agent counts.
// Owner Dashboard only. The mount applies authenticateTokenOD
// and requireRole('OWNER'); this handler trusts req.user is OWNER.
//
// Query shape: 5 parallel queries, stitched in JS. No N+1.
//   - orgs: the rows.
//   - agentCounts: User groupBy organizationId where role=AGENT.
//   - onlineCounts: DeviceRegistration groupBy organizationId where
//                   isAuthorized=true and lastSeenAt > now-5min.
//   - lastLogins: User groupBy organizationId _max lastLogin.
//   - licenses: all licenses desc by createdAt; latest per org picked in JS.
router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [orgs, agentCounts, onlineCounts, lastLogins, licenses] = await Promise.all([
      prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          clientType: true,
          contactEmail: true,
          contactPhone: true,
          verificationStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.groupBy({
        by: ['organizationId'],
        where: { role: 'AGENT', organizationId: { not: null } },
        _count: { _all: true },
      }),
      prisma.deviceRegistration.groupBy({
        by: ['organizationId'],
        where: {
          isAuthorized: true,
          lastSeenAt: { gt: fiveMinAgo },
        },
        _count: { _all: true },
      }),
      prisma.user.groupBy({
        by: ['organizationId'],
        where: { organizationId: { not: null } },
        _max: { lastLogin: true },
      }),
      prisma.license.findMany({
        select: { organizationId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const agentMap = new Map<string, number>();
    for (const row of agentCounts) {
      if (row.organizationId) agentMap.set(row.organizationId, row._count._all);
    }

    const onlineMap = new Map<string, number>();
    for (const row of onlineCounts) {
      onlineMap.set(row.organizationId, row._count._all);
    }

    const lastLoginMap = new Map<string, Date | null>();
    for (const row of lastLogins) {
      if (row.organizationId) {
        lastLoginMap.set(row.organizationId, row._max.lastLogin ?? null);
      }
    }

    // Licenses are ordered desc by createdAt; first hit per org is latest.
    const licenseMap = new Map<string, string>();
    for (const l of licenses) {
      if (!licenseMap.has(l.organizationId)) {
        licenseMap.set(l.organizationId, l.status);
      }
    }

    const data = orgs.map((org) => {
      const registered = agentMap.get(org.id) ?? 0;
      const online = onlineMap.get(org.id) ?? 0;
      return {
        id: org.id,
        name: org.name,
        clientType: org.clientType,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        verificationStatus: org.verificationStatus,
        createdAt: org.createdAt,
        lastActivity: lastLoginMap.get(org.id) ?? null,
        agentCounts: {
          registered,
          online,
          offline: Math.max(0, registered - online),
        },
        licenseStatus: licenseMap.get(org.id) ?? 'NONE',
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('[ADMIN] organizations failed:', error.message);
    return res
      .status(500)
      .json({ success: false, error: 'Failed to list organizations' });
  }
});

export default router;