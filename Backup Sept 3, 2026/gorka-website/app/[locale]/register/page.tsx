"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function RegisterPage() {
  const t = useTranslations('auth.register');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  const stepParam = searchParams.get('step');
  
  if (stepParam === '3') {
    setStep(3);
    setIsLoading(true);
    
    const checkCookie = setInterval(() => {
      if (document.cookie.includes('gorka_registration_session')) {
        setIsLoading(false);
        clearInterval(checkCookie);
      }
    }, 300);
    
    setTimeout(() => {
      setIsLoading(false);
      clearInterval(checkCookie);
    }, 5000);
  }
}, [searchParams]);
  
  // Step 1: Company Information
const [companyData, setCompanyData] = useState({
  companyName: '',
  clientType: 'AGENCY',
  registrationNumber: '',
  taxId: '',
  firstName: '',
  lastName: '',
  primaryContact: '',  // ← Keep this for backend compatibility
  contactEmail: '',
  contactPhone: '',
  address: '',
  website: '',
});
  
  // Step 3: Password & Terms
  const [passwordData, setPasswordData] = useState({
    password: '',
    termsAccepted: false,
  });
  
  const [organizationId, setOrganizationId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');

  // Step 1: Submit Company Information
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyData),
      });

      const data = await response.json();

      if (data.success) {
        setOrganizationId(data.data.organizationId);
        setVerificationToken(data.data.rawToken || '');
        setStep(2);
        setStatus('idle');
      } else {
        setErrorMessage(data.error?.message || t('error'));
        setStatus('error');
      }
    } catch (error) {
      setErrorMessage(t('error'));
      setStatus('error');
    }
  };

  // Step 2: Verify Email
  const handleResendVerification = async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...companyData, resend: true }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('idle');
        alert(t('step2.resendSuccess'));
      } else {
        setErrorMessage(data.error?.message || t('error'));
        setStatus('error');
      }
    } catch (error) {
      setErrorMessage(t('error'));
      setStatus('error');
    }
  };



  // Step 3: Complete Registration
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: passwordData.password,
          termsAccepted: passwordData.termsAccepted,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          router.push(data.data.redirectUrl || '/');
        }, 2000);
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
        <div className="container-gorka max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gorka-dark text-center mb-4">
            {t('title')}
          </h1>

          {/* Step Indicator */}
          <div className="flex justify-center mb-8 space-x-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s === step ? 'bg-gorka-violet text-white' :
                  s < step ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && <div className={`w-12 h-0.5 mx-1 ${
                  s < step ? 'bg-green-500' : 'bg-gray-200'
                }`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Company Information */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gorka-dark mb-4">{t('step1.title')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.companyName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyData.companyName}
                    onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.clientType')} *
                  </label>
                  <select
                    required
                    value={companyData.clientType}
                    onChange={(e) => setCompanyData({ ...companyData, clientType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  >
                    <option value="AGENCY">{t('step1.clientTypeAgency')}</option>
                    <option value="CORPORATE">{t('step1.clientTypeCorporate')}</option>
                    <option value="FREELANCER">{t('step1.clientTypeFreelancer')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.registrationNumber')}
                  </label>
                  <input
                    type="text"
                    value={companyData.registrationNumber}
                    onChange={(e) => setCompanyData({ ...companyData, registrationNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.taxId')}
                  </label>
                  <input
                    type="text"
                    value={companyData.taxId}
                    onChange={(e) => setCompanyData({ ...companyData, taxId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  />
                </div>

<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      First Name *
    </label>
    <input
      type="text"
      required
      value={companyData.firstName || ''}
      onChange={(e) => setCompanyData({ ...companyData, firstName: e.target.value })}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
      placeholder="John"
    />
  </div>
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Last Name *
    </label>
    <input
      type="text"
      required
      value={companyData.lastName || ''}
      onChange={(e) => setCompanyData({ ...companyData, lastName: e.target.value })}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
      placeholder="Doe"
    />
  </div>
</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.contactEmail')} *
                  </label>
                  <input
                    type="email"
                    required
                    value={companyData.contactEmail}
                    onChange={(e) => setCompanyData({ ...companyData, contactEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.contactPhone')} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={companyData.contactPhone}
                    onChange={(e) => setCompanyData({ ...companyData, contactPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.address')}
                  </label>
                  <input
                    type="text"
                    value={companyData.address}
                    onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('step1.website')}
                  </label>
                  <input
                    type="url"
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
                  />
                </div>

                {errorMessage && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full px-6 py-3 bg-gorka-violet text-white font-semibold rounded-lg hover:bg-gorka-violet/90 transition disabled:opacity-50"
                >
                  {status === 'loading' ? 'Sending...' : t('step1.submit')}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Email Verification */}
          {step === 2 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
              <h2 className="text-xl font-semibold text-gorka-dark mb-4">{t('step2.title')}</h2>
              <p className="text-gray-600 mb-2">
                {t('step2.subtitle')} <strong>{companyData.contactEmail}</strong>
              </p>
              <p className="text-gray-500 mb-6">{t('step2.checkEmail')}</p>
              
              <button
                onClick={handleResendVerification}
                disabled={status === 'loading'}
                className="px-6 py-2 text-gorka-violet hover:text-gorka-violet/80 transition disabled:opacity-50"
              >
                {status === 'loading' ? 'Sending...' : t('step2.resend')}
              </button>

              {errorMessage && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center mt-4">
                  {errorMessage}
                </div>
              )}


            </div>
          )}

{/* Step 3: Create Account */}
{step === 3 && (
  <>
    {isLoading ? (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gorka-violet mx-auto mb-4"></div>
        <p className="text-gray-600">Setting up your account...</p>
      </div>
    ) : (
      <form onSubmit={handleStep3Submit} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gorka-dark mb-4">{t('step3.title')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('step3.password')} *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={passwordData.password}
              onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gorka-violet focus:border-transparent outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">{t('step3.passwordHint')}</p>
          </div>

          <div className="flex items-start">
            <input
              type="checkbox"
              id="terms"
              checked={passwordData.termsAccepted}
              onChange={(e) => setPasswordData({ ...passwordData, termsAccepted: e.target.checked })}
              className="mt-1 mr-2"
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              {t('step3.terms')}
            </label>
          </div>

          {errorMessage && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
              {errorMessage}
            </div>
          )}

          {status === 'success' && (
            <div className="p-4 bg-green-50 text-green-700 rounded-lg text-center">
              {t('success')}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !passwordData.termsAccepted}
            className="w-full px-6 py-3 bg-gorka-violet text-white font-semibold rounded-lg hover:bg-gorka-violet/90 transition disabled:opacity-50"
          >
            {status === 'loading' ? 'Creating...' : t('step3.submit')}
          </button>
        </div>
      </form>
    )}
  </>
)}
</div>
</section>
<Footer />
</main>
);
}