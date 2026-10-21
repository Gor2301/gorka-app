import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  metadataBase: new URL('https://www.gorka.click'),
  title: 'GORKA \u2014 AI-Powered Debt Collection Platform',
  description:
    'Built for agencies. Ready for banks. Automate collections with AI Copilot.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages(); // <-- THIS IS THE FIX

  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans antialiased bg-gorka-cream text-gorka-dark">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}