import { Request, Response, NextFunction } from 'express';

// Curried middleware factory. Accepts one or more permitted roles.
// Returns a middleware that checks req.user.role against the list.
// The role is set by authenticateToken or authenticateTokenOD.
export const requireRole = (...allowed: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    if (!allowed.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient role',
      });
    }

    return next();
  };
};