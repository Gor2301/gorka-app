"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const t = useTranslations("footer");
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  
  const navLinks = [
    { href: `/${locale}`, label: "Home" },
    { href: `/${locale}/about`, label: "About" },
    { href: `/${locale}/pricing`, label: "Pricing" },
    { href: `/${locale}/faq`, label: "FAQ" },
    { href: `/${locale}/contact`, label: "Contact" },
  ];
  
  return (
    <footer className="bg-gorka-dark text-white pt-12 pb-6">
      <div className="container-gorka">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <span className="text-2xl font-bold tracking-[-0.05em] text-[#F01428]">
              GORKA
            </span>
            <p className="text-gray-400 text-sm mt-2">
              {t("tagline")}
            </p>
          </div>
          
          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Navigation</h4>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-white text-sm transition">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Contact</h4>
            <a href={`mailto:${t("contact")}`} className="text-gray-400 hover:text-white text-sm transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {t("contact")}
            </a>
          </div>
          
          {/* Social */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Follow Us</h4>
            <div className="flex gap-3">
              <a 
                href="https://x.com/gorka" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition"
                aria-label="X (Twitter)"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a 
                href="https://linkedin.com/company/gorka" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition"
                aria-label="LinkedIn"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            {t("copyright")}
          </p>
          <div className="flex gap-4 text-sm">
            <Link href={`/${locale}/privacy-policy`} className="text-gray-500 hover:text-white transition">
              Privacy
            </Link>
            <Link href={`/${locale}/terms`} className="text-gray-500 hover:text-white transition">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}