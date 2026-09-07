"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        // Redirect to dashboard after 1 second
        setTimeout(() => {
          router.push(data.data.redirectUrl || '/');
        }, 1000);
      } else {
        setErrorMessage(data.error?.message || t('error'));
        setStatus('error');
      }
    } catch (error) {
      setErrorMessage(t('error'));
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen">
      <Header />
      <section className="pt-16 md:pt-20 bg-gorka-cream min-h-[70vh] flex items-center">
        <div className="container-gorka max-w-md mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gorka-dark text-center mb-4">
            {t('title')}
          </h1>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('email')} *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('password')} *
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                />
              </div>

              {errorMessage && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
                  {errorMessage}
                </div>
              )}

              {status === 'success' && (
                <div className="p-4 bg-green-50 text-green-700 rounded-lg text-center">
                  Login successful! Redirecting...
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full px-6 py-3 bg-gorka-violet text-white font-semibold rounded-lg hover:bg-gorka-violet/90 transition disabled:opacity-50"
              >
                {status === 'loading' ? 'Logging in...' : t('submit')}
              </button>

              <div className="text-center text-sm text-gray-500">
                <p>
                  {t('noAccount')}{' '}
                  <Link href="/register" className="text-gorka-violet hover:underline">
                    {t('register')}
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </section>
      <Footer />
    </main>
  );
}