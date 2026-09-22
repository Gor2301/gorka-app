import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();

// ==================== GET ALL ROLES WITH PERMISSIONS ====================
router.get('/roles', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const organizationId = (req as any).organizationId;

    // Get all permission roles for this organization
    const permissions = await prisma.permissionRole.findMany({
      where: { organizationId },
      orderBy: { role: 'asc' }
    });

    // Group by role
    const groupedPermissions: Record<string, string[]> = {};
    permissions.forEach((p: any) => {
      if (!groupedPermissions[p.role]) {
        groupedPermissions[p.role] = [];
      }
      groupedPermissions[p.role].push(p.permission);
    });

    // Also include roles that might not have permissions yet
    const allRoles = ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'];
    const result = allRoles.map(role => ({
      role,
      permissions: groupedPermissions[role] || []
    }));

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Get permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch permissions'
    });
  }
});

// ==================== UPDATE ROLE PERMISSIONS ====================
router.put('/roles/:roleName', authenticateToken, requireTenant, async (req: any, res: Response) => {
  try {
    const { roleName } = req.params;
    const { permissions } = req.body;
    const organizationId = (req as any).organizationId;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions array is required'
      });
    }

    // Delete existing permissions for this role
    await prisma.permissionRole.deleteMany({
      where: {
        role: roleName as any,
        organizationId
      }
    });

    // Create new permissions
    const created = [];
    for (const permission of permissions) {
      const result = await prisma.permissionRole.create({
        data: {
          role: roleName as any,
          permissions: permission as any,
          organizationId
        }
      });
      created.push(result);
    }

    return res.json({
      success: true,
      data: {
        role: roleName,
        permissions: created.map((p: any) => p.permission)
      }
    });
  } catch (error: any) {
    console.error('Update permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update permissions'
    });
  }
});

export default router;