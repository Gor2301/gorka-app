"use client";

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function Header() {
  const t = useTranslations('nav');
  const tLogin = useTranslations('auth.login');

  const navLinks = [
    { key: 'home', href: '/' },
    { key: 'pricing', href: '/pricing' },
    { key: 'faq', href: '/faq' },
    { key: 'contact', href: '/contact' },
  ] as const;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gorka-cream/95 backdrop-blur border-b border-gray-200">
      <div className="container-gorka flex items-center justify-between h-16 md:h-20">
        <Link href="/" className="text-2xl font-bold text-gorka-red">
          GORKA
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="text-sm font-medium text-gorka-dark hover:text-gorka-violet transition"
            >
              {t(link.key)}
            </Link>
          ))}
          <Link
            href="/download"
            className="text-sm font-medium text-white bg-[#F01428] px-3 py-1.5 rounded-md hover:bg-[#F01428]/90 transition"
          >
            {t('download')}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline text-sm font-medium text-gorka-dark hover:text-gorka-violet transition"
          >
            {tLogin('submit')}
          </Link>
          <Link
            href="/contact"
            className="px-4 py-2 bg-gorka-violet text-white rounded-lg text-sm font-medium hover:bg-gorka-violet/90 transition"
          >
            {t('bookDemo')}
          </Link>
        </div>
      </div>
    </header>
  );
}