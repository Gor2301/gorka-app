"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";

export default function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get current locale from pathname
  const locale = pathname?.split("/")[1] || "en";

  const navLinks = [
    { href: `/${locale}`, label: t("home") },
    { href: `/${locale}/about`, label: t("about") },
    { href: `/${locale}/pricing`, label: t("pricing") },
    { href: `/${locale}/faq`, label: t("faq") },
    { href: `/${locale}/contact`, label: t("contact") },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container-gorka">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex-shrink-0">
            <span className="text-2xl font-bold tracking-[-0.05em] text-[#F01428]">
              GORKA
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-gorka-violet transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: Language Switcher + CTA */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language Switcher */}
            <div className="flex items-center gap-1">
              <Link
                href={`/en${pathname?.replace(/^\/[a-z]{2}/, "") || ""}`}
                className={`px-2 py-1 text-sm font-medium rounded transition ${
                  locale === "en"
                    ? "text-gorka-violet bg-gorka-violet/10"
                    : "text-gray-500 hover:text-gorka-violet"
                }`}
              >
                EN
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href={`/es${pathname?.replace(/^\/[a-z]{2}/, "") || ""}`}
                className={`px-2 py-1 text-sm font-medium rounded transition ${
                  locale === "es"
                    ? "text-gorka-violet bg-gorka-violet/10"
                    : "text-gray-500 hover:text-gorka-violet"
                }`}
              >
                ES
              </Link>
            </div>

            {/* CTA Button */}
            <Link href={`/${locale}/contact`}>
              <button className="px-6 py-2.5 bg-gorka-violet text-white text-sm font-semibold rounded-lg hover:bg-gorka-violet/90 transition shadow-sm">
                {t("bookDemo")}
              </button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 text-gray-600 hover:text-gorka-violet transition"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-6 border-t border-gray-100">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="text-base font-medium text-gray-600 hover:text-gorka-violet transition"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <Link
                  href={`/en${pathname?.replace(/^\/[a-z]{2}/, "") || ""}`}
                  onClick={closeMobileMenu}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition ${
                    locale === "en"
                      ? "text-gorka-violet bg-gorka-violet/10"
                      : "text-gray-500 hover:text-gorka-violet"
                  }`}
                >
                  EN
                </Link>
                <span className="text-gray-300">|</span>
                <Link
                  href={`/es${pathname?.replace(/^\/[a-z]{2}/, "") || ""}`}
                  onClick={closeMobileMenu}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition ${
                    locale === "es"
                      ? "text-gorka-violet bg-gorka-violet/10"
                      : "text-gray-500 hover:text-gorka-violet"
                  }`}
                >
                  ES
                </Link>
                <Link href={`/${locale}/contact`} onClick={closeMobileMenu} className="ml-auto">
                  <button className="px-5 py-2 bg-gorka-violet text-white text-sm font-semibold rounded-lg hover:bg-gorka-violet/90 transition">
                    {t("bookDemo")}
                  </button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}