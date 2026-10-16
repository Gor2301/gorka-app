import Header from '@/components/layout/Header';
import FAQ from '@/components/sections/FAQ';
import Footer from '@/components/layout/Footer';

export default function FAQPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-16 md:pt-20 bg-gorka-cream">
        <div className="container-gorka text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gorka-dark">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Everything you need to know about GORKA
          </p>
        </div>
      </section>
      <FAQ />
      <Footer />
    </main>
  );
}