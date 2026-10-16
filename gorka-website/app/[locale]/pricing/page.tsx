import Header from '@/components/layout/Header';
import Pricing from '@/components/sections/Pricing';
import Footer from '@/components/layout/Footer';

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-16 md:pt-20 bg-gorka-cream">
        <div className="container-gorka text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gorka-dark">
            Choose your plan
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Start free. Scale when you're ready.
          </p>
        </div>
      </section>
      <Pricing />
      <Footer />
    </main>
  );
}