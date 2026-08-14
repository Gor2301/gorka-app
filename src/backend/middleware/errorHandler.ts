import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';
import { ErrorCodes } from '../errors/errorCodes';

// Simple request ID generator
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Global error handling middleware
 * Converts all errors to a consistent JSON format
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = generateRequestId();

  // Default values
  let statusCode = 500;
  let errorCode: string = ErrorCodes.GENERAL_001;
  let message = 'Internal server error';
  let details: any = undefined;

  // If it's our custom error, use its properties
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details;
    err.requestId = requestId;
  } else {
    // Unknown error - log it but don't expose details
    message = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';
  }

  // Log the error
  const logContext = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    code: errorCode,
    message,
    isOperational: err instanceof AppError ? err.isOperational : false,
    ip: req.ip,
    userId: (req as any).user?.id || 'anonymous',
  };

  if (statusCode >= 500) {
    logger.error(`❌ ${req.method} ${req.originalUrl} - ${statusCode}`, logContext);
  } else {
    logger.warn(`⚠️ ${req.method} ${req.originalUrl} - ${statusCode}`, logContext);
  }

  // Build error response
  const errorResponse: any = {
    success: false,
    error: {
      code: errorCode,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  // Add details if present
  if (details) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const err = AppError.notFound(`Route ${req.method} ${req.originalUrl}`);
  err.requestId = generateRequestId();
  next(err);
};

/**
 * Async handler wrapper to catch errors in async functions
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;