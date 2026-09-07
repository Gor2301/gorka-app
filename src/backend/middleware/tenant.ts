import { Request, Response, NextFunction } from 'express';

export const requireTenant = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // For SUPER_ADMIN, organizationId can come from query or body
    if (user.role === 'SUPER_ADMIN') {
      const orgId = user.organizationId || req.body?.organizationId || req.query?.organizationId;
      
      if (orgId) {
        (req as any).organizationId = orgId;
        return next();
      }
      
      return res.status(400).json({
        success: false,
        error: 'organizationId required for SUPER_ADMIN'
      });
    }

    // For regular users, use their organizationId
    if (!user.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'User has no organization assigned'
      });
    }

    (req as any).organizationId = user.organizationId;
    next();
  } catch (error: any) {
    console.error('Tenant middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate tenant'
    });
  }
};