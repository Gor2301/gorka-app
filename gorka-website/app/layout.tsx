import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'GORKA — AI-Powered Debt Collection Platform',
  description: 'Built for agencies. Ready for banks. Automate collections with AI Copilot.',
};

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={params.locale} className={inter.variable}>
      <body className="font-sans antialiased bg-gorka-cream text-gorka-dark">
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}