"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function SupportPage() {
  const t = useTranslations('support');
  const router = useRouter();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: 'OTHER',
    piiAcknowledged: false,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        setIsAuthenticated(data.success);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setTicketNumber(data.data.ticketNumber);
        setStatus('success');
        setFormData({ subject: '', message: '', category: 'OTHER', piiAcknowledged: false });
      } else {
        setErrorMessage(data.error?.message || t('error'));
        setStatus('error');
      }
    } catch (error) {
      setErrorMessage(t('error'));
      setStatus('error');
    }
  };

  // If not authenticated, show login message
  if (isAuthenticated === false) {
    return (
      <main className="min-h-screen">
        <Header />
        <section className="pt-16 md:pt-20 bg-gorka-cream min-h-[70vh] flex items-center">
          <div className="container-gorka max-w-md mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gorka-dark mb-2">{t('loginRequired')}</h2>
              <button
                onClick={() => router.push('/login')}
                className="mt-4 px-6 py-2 bg-gorka-violet text-white font-semibold rounded-lg hover:bg-gorka-violet/90 transition"
              >
                Go to Login
              </button>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-16 md:pt-20 bg-gorka-cream min-h-[70vh] flex items-center">
        <div className="container-gorka max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gorka-dark text-center mb-2">
            {t('title')}
          </h1>
          <p className="text-gray-600 text-center mb-6">{t('subtitle')}</p>

          {status === 'success' && ticketNumber && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg text-center">
              <p className="font-semibold">{t('success')}</p>
              <p>{t('successMessage')}{ticketNumber}{t('successMessage2')}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('subject')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder={t('subjectPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('category')} *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                >
                  <option value="BILLING">{t('categoryBilling')}</option>
                  <option value="TECHNICAL">{t('categoryTechnical')}</option>
                  <option value="ACCOUNT_ACCESS">{t('categoryAccount')}</option>
                  <option value="FEATURE_REQUEST">{t('categoryFeature')}</option>
                  <option value="BUG">{t('categoryBug')}</option>
                  <option value="OTHER">{t('categoryOther')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('message')} *
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={t('messagePlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="pii"
                  checked={formData.piiAcknowledged}
                  onChange={(e) => setFormData({ ...formData, piiAcknowledged: e.target.checked })}
                  className="mt-1 mr-2"
                />
                <label htmlFor="pii" className="text-sm text-gray-600">
                  {t('piiAcknowledged')}
                </label>
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading' || !formData.piiAcknowledged}
                className="w-full px-6 py-3 bg-gorka-violet text-white font-semibold rounded-lg hover:bg-gorka-violet/90 transition disabled:opacity-50"
              >
                {status === 'loading' ? 'Submitting...' : t('submit')}
              </button>
            </div>
          </form>
        </div>
      </section>
      <Footer />
    </main>
  );
}