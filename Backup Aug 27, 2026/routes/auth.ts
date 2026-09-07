import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const registerSchema = z.object({
  companyName: z.string().min(1),
  clientType: z.string().min(1),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  primaryContact: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(1),
  address: z.string().optional(),
  website: z.string().optional(),
  billingEmail: z.string().email().optional(),
  billingPhone: z.string().optional(),
  password: z.string().min(8),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: 'You must accept the Terms of Service'
  })
});


// Generate JWT token
const generateToken = (userId: string, email: string, role: string, organizationId: string) => {
  return jwt.sign(
    { userId, email, role, organizationId },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '7d' }
  );
};

// ==================== LOGIN ====================
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const { email, password } = validation.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is disabled'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate token
    const token = generateToken(user.id, user.email, user.role, user.organizationId);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          isActive: user.isActive
        }
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to login'
    });
  }
});

// ==================== GET CURRENT USER ====================
router.get('/me', async (req: any, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
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
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user'
    });
  }
});

// ==================== REGISTRATION ====================
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const data = validation.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.contactEmail }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create organization with user
    const organization = await prisma.organization.create({
      data: {
        name: data.companyName,
        clientType: data.clientType,
        registrationNumber: data.registrationNumber,
        taxId: data.taxId,
        primaryContact: data.primaryContact,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        website: data.website,
        billingEmail: data.billingEmail,
        billingPhone: data.billingPhone,
        termsAcceptedAt: new Date(),
        verificationStatus: 'PENDING_EMAIL',
        users: {
          create: {
            email: data.contactEmail,
            passwordHash: passwordHash,
            name: data.primaryContact,
            role: 'AGENT',
            isActive: true
          }
        }
      },
      include: {
        users: true
      }
    });

    // Log registration
    await prisma.activityLog.create({
      data: {
        organizationId: organization.id,
        userId: organization.users[0].id,
        action: 'REGISTER',
        entityType: 'ORGANIZATION',
        entityId: organization.id,
        details: {
          companyName: data.companyName,
          contactEmail: data.contactEmail
        }
      }
    });

    // TODO: Send verification email (console log for MVP)
    console.log(`📧 Verification email would be sent to: ${data.contactEmail}`);
    console.log(`🔗 Verification link: http://localhost:5173/verify-email?email=${data.contactEmail}`);

    return res.status(201).json({
      success: true,
      data: {
        organizationId: organization.id,
        userId: organization.users[0].id,
        message: 'Registration successful. Please verify your email.',
        // For testing only — remove in production
        verificationLink: `http://localhost:5173/verify-email?email=${data.contactEmail}`
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to register'
    });
  }
});

// ==================== EMAIL VERIFICATION ====================
const verifyEmailSchema = z.object({
  email: z.string().email()
});

router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const validation = verifyEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const { email } = validation.data;

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if already verified
    if (user.organization.verificationStatus === 'EMAIL_VERIFIED' ||
        user.organization.verificationStatus === 'PENDING_REVIEW' ||
        user.organization.verificationStatus === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Email already verified'
      });
    }

    // Update organization verification status
    const updatedOrg = await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        verificationStatus: 'PENDING_REVIEW',
        emailVerifiedAt: new Date()
      }
    });

    // Log the verification
    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'EMAIL_VERIFIED',
        entityType: 'ORGANIZATION',
        entityId: user.organizationId,
        details: {
          email: email,
          verificationStatus: 'PENDING_REVIEW'
        }
      }
    });

    console.log(`✅ Email verified for: ${email}`);
    console.log(`📋 Organization ${updatedOrg.id} is now PENDING_REVIEW`);

    return res.json({
      success: true,
      data: {
        message: 'Email verified successfully. Your account is now pending review by the owner.',
        organizationId: user.organizationId,
        verificationStatus: 'PENDING_REVIEW'
      }
    });
  } catch (error: any) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify email'
    });
  }
});

// ==================== RESEND VERIFICATION ====================
const resendVerificationSchema = z.object({
  email: z.string().email()
});

router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const validation = resendVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.issues
      });
    }

    const { email } = validation.data;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if already verified
    if (user.organization.verificationStatus === 'EMAIL_VERIFIED' ||
        user.organization.verificationStatus === 'PENDING_REVIEW' ||
        user.organization.verificationStatus === 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Email already verified'
      });
    }

    // Log the resend
    await prisma.activityLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'VERIFICATION_RESENT',
        entityType: 'ORGANIZATION',
        entityId: user.organizationId,
        details: {
          email: email
        }
      }
    });

    console.log(`📧 Verification email resent to: ${email}`);
    console.log(`🔗 Verification link: http://localhost:5173/verify-email?email=${email}`);

    return res.json({
      success: true,
      data: {
        message: 'Verification email resent successfully',
        // For testing only — remove in production
        verificationLink: `http://localhost:5173/verify-email?email=${email}`
      }
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to resend verification'
    });
  }
});

export default router;