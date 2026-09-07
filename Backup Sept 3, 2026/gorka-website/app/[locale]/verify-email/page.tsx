"use client";

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail');
  const router = useRouter();

const verificationStarted = useRef(false);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

useEffect(() => {
  if (verificationStarted.current) {
    console.log('🟡 Duplicate verification prevented');
    return;
  }
  verificationStarted.current = true;



  // Get token from URL — runs only in browser
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');

  if (!token) {
    setStatus('error');
    setErrorMessage('No verification token provided.');
    return;
  }

  const verifyEmail = async () => {
    setStatus('loading');

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setTimeout(() => {
          router.push('/register?step=3');
        }, 5000);
      } else {
        setErrorMessage(data.error?.message || t('error'));
        setStatus('error');
      }
    } catch (error) {
      setErrorMessage(t('errorMessage'));
      setStatus('error');
    }
  };

  verifyEmail();
}, [router, t]);

  const handleResend = () => {
    router.push('/register');
  };

  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-16 md:pt-20 bg-gorka-cream min-h-[70vh] flex items-center">
        <div className="container-gorka max-w-md mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gorka-dark text-center mb-4">
            {t('title')}
          </h1>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            {status === 'loading' && (
              <div className="py-8">
                <div className="w-12 h-12 border-4 border-gorka-violet border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">{t('verifying')}</p>
              </div>
            )}

            {status === 'success' && (
              <div className="py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-green-700 mb-2">{t('success')}</h2>
                <p className="text-gray-600 mb-4">{t('successMessage')}</p>
                <p className="text-sm text-gray-500">Redirecting to registration...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-red-700 mb-2">{t('error')}</h2>
                <p className="text-gray-600 mb-4">{errorMessage || t('errorMessage')}</p>
                <button
                  onClick={handleResend}
                  className="px-6 py-2 text-gorka-violet hover:text-gorka-violet/80 transition"
                >
                  {t('resend')}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}