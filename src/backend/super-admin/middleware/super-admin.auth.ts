import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gorka-secret-key-change-this';

// Super Admin role check
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if user has super admin role
    if (decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Super admin access required'
      });
    }

    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};