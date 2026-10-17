import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Header from '@/components/layout/Header';
import Features from '@/components/sections/Features';
import DataControl from '@/components/sections/DataControl';
import AICopilot from '@/components/sections/AICopilot';
import WhyGorka from '@/components/sections/WhyGorka';
import Comparison from '@/components/sections/Comparison';
import Pricing from '@/components/sections/Pricing';
import FAQ from '@/components/sections/FAQ';
import FinalCTA from '@/components/sections/FinalCTA';
import Footer from '@/components/layout/Footer';

export default function HomePage() {
  const t = useTranslations('hero');

  return (
    <main className="min-h-screen">
      <Header />
      
      {/* 1. Hero Section */}
      <section className="flex items-center justify-center min-h-screen bg-gorka-cream pt-16 md:pt-20">
        <div className="container-gorka text-center max-w-4xl mx-auto px-4">
          <p className="text-sm font-semibold tracking-widest text-[#F01428] uppercase mb-4">
            {t('eyebrow')}
          </p>
          
          <h1 className="text-4xl md:text-6xl font-bold text-gorka-dark mb-6 leading-tight">
            {t('title')}
          </h1>
          
          <p className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto mb-6 leading-relaxed">
            {t('subtitle')}
          </p>
          
          <p className="text-base text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('subtext')}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="px-8 py-3 bg-gorka-violet text-white rounded-lg font-semibold hover:bg-gorka-violet/90 transition shadow-md">
              {t('ctaPrimary')}
            </Link>
            <a href="#features" className="px-8 py-3 bg-white text-gorka-dark border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition shadow-sm">
              {t('ctaSecondary')}
            </a>
          </div>
        </div>
      </section>

      {/* 2. Features (5 Images) */}
      <Features />

      {/* 3. Data Control */}
      <DataControl />

      {/* 4. AI Vision */}
      <AICopilot />

      {/* 5. Why Gorka */}
      <WhyGorka />

      {/* 6. Comparison Table */}
      <Comparison />

      {/* 7. Pricing */}
      <Pricing />

      {/* 8. FAQ */}
      <FAQ />

      {/* 9. Final CTA */}
      <FinalCTA />
      
      <Footer />
    </main>
  );
}