import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();

// GET /api/permissions/roles
router.get('/roles', authenticateToken, requireTenant, async (req: Request, res: Response) => {
  try {
    const orgId = req.organizationId as string;

    const roles = ['SUPERVISOR', 'AGENT'];
    const result = [];

    for (const role of roles) {
      const permissions = await prisma.rolePermission.findMany({
        where: {
          role,
          organizationId: orgId
        }
      });

      const permMap: Record<string, boolean> = {};
      for (const p of permissions) {
        permMap[p.permissionId] = p.enabled;
      }

      result.push({
        name: role,
        permissions: permMap
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// PUT /api/permissions/roles/:roleName
router.put('/roles/:roleName', authenticateToken, requireTenant, async (req: Request, res: Response) => {
  try {
    const roleName = req.params.roleName as string;
    const { permissions } = req.body;
    const orgId = req.organizationId as string;

    const operations = [];
    for (const [permissionId, enabled] of Object.entries(permissions)) {
      operations.push(
        prisma.rolePermission.upsert({
          where: {
            role_permissionId_organizationId: {
              role: roleName,
              permissionId: permissionId,
              organizationId: orgId
            }
          },
          update: {
            enabled: enabled as boolean
          },
          create: {
            role: roleName,
            permissionId: permissionId,
            enabled: enabled as boolean,
            organizationId: orgId
          } as any
        })
      );
    }

    await prisma.$transaction(operations);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating permissions:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

export default router;