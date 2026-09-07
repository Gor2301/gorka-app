import rateLimit from 'express-rate-limit';

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { 
    success: false, 
    error: { 
      code: 'RATE_LIMITED', 
      message: 'Too many registration attempts. Please try again later.' 
    } 
  },
});

export const loginIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  message: { 
    success: false, 
    error: { 
      code: 'RATE_LIMITED', 
      message: 'Too many login attempts from this IP. Please try again later.' 
    } 
  },
});

export const loginEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.email?.toLowerCase().trim() || 'unknown',
  message: { 
    success: false, 
    error: { 
      code: 'RATE_LIMITED', 
      message: 'Too many login attempts for this account. Please try again later.' 
    } 
  },
});

export const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { 
    success: false, 
    error: { 
      code: 'RATE_LIMITED', 
      message: 'Too many verification attempts. Please try again later.' 
    } 
  },
});

export const completeRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { 
    success: false, 
    error: { 
      code: 'RATE_LIMITED', 
      message: 'Too many attempts. Please try again later.' 
    } 
  },
});

export const supportTicketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { 
    success: false, 
    error: { 
      code: 'RATE_LIMITED', 
      message: 'Too many ticket submissions. Please try again later.' 
    } 
  },
});