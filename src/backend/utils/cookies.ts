export const getCookieOptions = () => ({
  httpOnly: true,
  secure: false,
  sameSite: 'lax' as const,
  domain: '.localhost',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

export const getRegistrationCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  domain: 'localhost',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
});