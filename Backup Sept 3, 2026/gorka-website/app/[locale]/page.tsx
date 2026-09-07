import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Features from '@/components/sections/Features';
import TwoColumn from '@/components/sections/TwoColumn';
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
      <section className="flex items-center justify-center min-h-screen bg-gorka-cream pt-16 md:pt-20">
        <div className="container-gorka text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gorka-dark">
            {t('title')}
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button className="px-8 py-3 bg-gorka-violet text-white rounded-lg font-semibold hover:bg-gorka-violet/90 transition">
              {t('ctaPrimary')}
            </button>
            <button className="px-8 py-3 bg-white text-gorka-dark border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition">
              {t('ctaSecondary')}
            </button>
          </div>
        </div>
      </section>
      <Features />
      <TwoColumn />
      <Comparison />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}