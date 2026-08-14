import { Request, Response, NextFunction } from 'express'

export const requireTenant = (req: Request, res: Response, next: NextFunction) => {
  // Get user from JWT (set by auth middleware)
  const user = req.user
  
  console.log('🔐 Tenant Check - User:', user?.email, 'Role:', user?.role)
  
  // SUPER_ADMIN bypasses tenant check
  if (user?.role === 'SUPER_ADMIN') {
    console.log('✅ SUPER_ADMIN bypass - allowing access')
    return next()
  }
  
  const organizationId = user?.organizationId
  
  if (!organizationId) {
    console.log('❌ No organization ID found')
    return res.status(403).json({
      success: false,
      error: 'No organization assigned to user'
    })
  }
  
  // Attach to request for use in routes
  (req as any).organizationId = organizationId
  console.log('✅ Tenant check passed for organization:', organizationId)
  next()
}