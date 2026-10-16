import Header from '@/components/layout/Header';
import FAQ from '@/components/sections/FAQ';
import Footer from '@/components/layout/Footer';

export default function FAQPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-16 md:pt-20">
        <FAQ />
      </section>
      <Footer />
    </main>
  );
}