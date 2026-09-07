import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = null;
    
    // 1. Check Authorization header first
    const authHeader = req.headers.authorization;
    console.log('[AUTH] Authorization header present:', !!authHeader);
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log('[AUTH] Token from Authorization header');
    }
    
    // 2. If no token in header, check cookie
    if (!token && req.cookies) {
      token = req.cookies.gorka_session;
      console.log('[AUTH] Token from cookie:', !!token);
    }
    
    console.log('[AUTH] Token present:', !!token);
    
    if (!token) {
      console.log('[AUTH] ❌ No token provided');
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    console.log('[AUTH] 🔍 Verifying token...');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    console.log('[AUTH] ✅ Token verified successfully');

console.log('[AUTH] Full decoded token:', JSON.stringify(decoded, null, 2));

    console.log('[AUTH] User ID:', decoded.userId);
    console.log('[AUTH] Organization ID:', decoded.organizationId);
    
    (req as any).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId
    };

    return next();
  } catch (error: any) {
    console.log('[AUTH] ❌ Token verification failed:', error.message);
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};