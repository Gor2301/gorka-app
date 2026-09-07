import { useTranslations } from 'next-intl';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function AboutPage() {
  const t = useTranslations('about');
  
  return (
    <main className="min-h-screen">
      <Header />
      <section className="flex items-center justify-center min-h-[70vh] bg-gorka-cream pt-16 md:pt-20">
        <div className="container-gorka text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gorka-dark mb-6">
            {t('title')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('content')}
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}