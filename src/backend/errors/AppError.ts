import { ErrorCode, ErrorCodes } from './errorCodes';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public requestId?: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCodes.GENERAL_001,
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.details = details;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
    
    // Set prototype for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert error to JSON response object
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        requestId: this.requestId,
        ...(this.details && { details: this.details }),
      },
    };
  }

  /**
   * Create validation error
   */
  static validationError(message: string, details?: any) {
    return new AppError(
      message,
      400,
      ErrorCodes.VALIDATION_001,
      true,
      details
    );
  }

  /**
   * Create not found error
   */
  static notFound(resource: string) {
    return new AppError(
      `${resource} not found`,
      404,
      ErrorCodes.GENERAL_003,
      true
    );
  }

  /**
   * Create unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized') {
    return new AppError(
      message,
      401,
      ErrorCodes.AUTH_001,
      true
    );
  }

  /**
   * Create forbidden error
   */
  static forbidden(message: string = 'Forbidden') {
    return new AppError(
      message,
      403,
      ErrorCodes.AUTH_002,
      true
    );
  }

  /**
   * Create internal server error
   */
  static internal(message: string = 'Internal server error') {
    return new AppError(
      message,
      500,
      ErrorCodes.GENERAL_001,
      false
    );
  }
}

export default AppError;