import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

// ==================== GET ALL USERS ====================
router.get('/', authenticateToken, requireTenant, async (req: any, res: any) => {
  try {
    const { role, search } = req.query;
    const organizationId = (req as any).organizationId;

    const where: any = { organizationId };

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error: any) {
    console.error('Users fetch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch users'
    });
  }
});

// ==================== CREATE USER (POST) ====================
router.post('/', authenticateToken, requireTenant, async (req: any, res: any) => {
  try {
    const organizationId = (req as any).organizationId;
    const { name, email, password, role, isActive } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
data: {
  name,
  email,
  passwordHash: hashedPassword,
  password: hashedPassword,
  role: role || 'AGENT',
  isActive: isActive !== undefined ? isActive : true,
  organization: {
    connect: { id: organizationId }
  }
},
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId: req.user.id,
        action: 'CREATE',
        entityType: 'USER',
        entityId: user.id,
        details: { name: user.name, email: user.email, role: user.role }
      }
    });

    return res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully'
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user'
    });
  }
});

// ==================== GET SINGLE USER ====================
router.get('/:id', authenticateToken, requireTenant, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).organizationId;

    const user = await prisma.user.findFirst({
      where: {
        id,
        organizationId
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    console.error('User fetch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch user'
    });
  }
});

// ==================== UPDATE USER ====================
router.put('/:id', authenticateToken, requireTenant, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, password } = req.body;
    const organizationId = (req as any).organizationId;

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        id,
        organizationId
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId: req.user.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: updatedUser.id,
        details: { name: updatedUser.name, email: updatedUser.email }
      }
    });

    return res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    });
  } catch (error: any) {
    console.error('User update error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user'
    });
  }
});

// ==================== DELETE USER ====================
router.delete('/:id', authenticateToken, requireTenant, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).organizationId;

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        id,
        organizationId
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't allow deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    await prisma.user.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId: req.user.id,
        action: 'DELETE',
        entityType: 'USER',
        entityId: id,
        details: { name: user.name, email: user.email }
      }
    });

    return res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    console.error('User delete error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user'
    });
  }
});

export default router;