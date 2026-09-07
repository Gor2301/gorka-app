import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;
  
  // Ensure locale is a string, fallback to 'en'
  if (!locale || typeof locale !== 'string') {
    locale = 'en';
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});