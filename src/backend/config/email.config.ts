// src/backend/config/email.config.ts
import 'dotenv/config';

export const EMAIL_CONFIG = {
  // Priority 1: Environment variable (for development/testing)
  fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  
  // Priority 2: Will check Configuration table in production
  // For now, .env is the source of truth
  
  provider: process.env.EMAIL_PROVIDER || 'resend',
  apiKey: process.env.RESEND_API_KEY || '',
  
  // Resend test domain (guaranteed to work)
  testDomain: 'onboarding@resend.dev',
} as const;

// Helper to get sender with validation
export function getSenderEmail(): string {
  const email = EMAIL_CONFIG.fromEmail;
  
  // If using Resend and email is not verified, warn but allow
  if (EMAIL_CONFIG.provider === 'resend' && !email.endsWith('@resend.dev')) {
    console.warn(`⚠️  Using non-Resend domain: ${email}. Verify in Resend dashboard or use onboarding@resend.dev for testing.`);
  }
  
  return email;
}