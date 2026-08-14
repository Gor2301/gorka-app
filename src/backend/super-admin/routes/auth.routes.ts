import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '../../config/logger';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'gorka-secret-key-change-this';

/**
 * POST /api/v1/admin/auth/login
 * Super Admin login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user with SUPER_ADMIN role
    const user = await prisma.user.findFirst({
      where: {
        email,
        role: 'SUPER_ADMIN'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      },
      JWT_SECRET,
      { expiresIn: '15m' } // Short expiration for super admin
    );

    logger.info(`Super Admin logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        expiresIn: 900 // 15 minutes in seconds
      }
    });

  } catch (error) {
    logger.error('Super Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

/**
 * POST /api/v1/admin/auth/logout
 * Super Admin logout
 */
router.post('/logout', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;