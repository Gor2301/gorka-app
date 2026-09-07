import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // For now, use 'en' as the default locale
  const locale = 'en';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});