import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔑 Auth Check - Token present:', !!token);

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gorka-secret-key-change-this') as any;
    console.log('✅ Decoded token:', decoded);
    
    (req as any).user = {
      id: decoded.id || decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
      email: decoded.email
    };
    next();
  } catch (error) {
    console.log('❌ Auth failed:', error);
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
};