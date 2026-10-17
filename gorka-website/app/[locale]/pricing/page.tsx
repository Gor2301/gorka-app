import Header from '@/components/layout/Header';
import Pricing from '@/components/sections/Pricing';
import Footer from '@/components/layout/Footer';

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="pt-16 md:pt-20">
        <Pricing />
      </div>
      <Footer />
    </main>
  );
}