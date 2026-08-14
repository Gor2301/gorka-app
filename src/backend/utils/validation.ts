import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/errorCodes';

/**
 * Validate required fields in request body
 */
export const validateRequired = (body: any, fields: string[]) => {
  const missing: string[] = [];
  
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw AppError.validationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missing }
    );
  }
};

/**
 * Validate email format
 */
export const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw AppError.validationError('Invalid email format', { email });
  }
};

/**
 * Validate phone number (basic)
 */
export const validatePhone = (phone: string) => {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  if (!phoneRegex.test(phone)) {
    throw AppError.validationError('Invalid phone number format', { phone });
  }
};

/**
 * Sanitize user input (basic)
 */
export const sanitize = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export default {
  validateRequired,
  validateEmail,
  validatePhone,
  sanitize,
};