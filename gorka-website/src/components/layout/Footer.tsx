"use client";

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');

  const navLinks = [
    { key: 'home', href: '/' },
    { key: 'pricing', href: '/pricing' },
    { key: 'faq', href: '/faq' },
    { key: 'download', href: '/download' },
    { key: 'contact', href: '/contact' },
  ] as const;

  return (
    <footer className="bg-gorka-dark text-white mt-auto">
      <div className="container-gorka py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="text-2xl font-bold text-gorka-red mb-3">
              GORKA
            </div>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              {t('tagline')}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-white mb-4 uppercase tracking-wider">
              Navigate
            </div>
            <ul className="space-y-2 text-sm">
              {navLinks.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className={
                      link.key === 'download'
                        ? 'text-[#F01428] font-medium hover:text-[#F01428]/80 transition'
                        : 'text-gray-400 hover:text-white transition'
                    }
                  >
                    {tNav(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-white mb-4 uppercase tracking-wider">
              Contact
            </div>
            <a
              href={`mailto:${t('contact')}`}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              {t('contact')}
            </a>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-xs text-gray-500">
          {t('copyright')}
        </div>
      </div>
    </footer>
  );
}