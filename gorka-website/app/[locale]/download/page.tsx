"use client";

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { UserPlus, Download, Settings, FileSpreadsheet, Users } from 'lucide-react';

const INSTALLERS = {
  client: {
    url: '/downloads/gorka-client-setup.exe',
  },
  agent: {
    url: '/downloads/gorka-agent-setup.exe',
  },
};

export default function DownloadPage() {
  const t = useTranslations('download');

  const steps = [
    { icon: UserPlus, title: t('pathStep1Title'), desc: t('pathStep1Desc') },
    { icon: Download, title: t('pathStep2Title'), desc: t('pathStep2Desc') },
    { icon: Settings, title: t('pathStep3Title'), desc: t('pathStep3Desc') },
    { icon: FileSpreadsheet, title: t('pathStep4Title'), desc: t('pathStep4Desc') },
    { icon: Users, title: t('pathStep5Title'), desc: t('pathStep5Desc') },
  ];

  return (
    <>
      <Header />
      <main className="pt-16 md:pt-20 bg-gorka-cream min-h-screen">
        <div
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            padding: '48px 24px 80px',
            color: '#111111',
          }}
        >
          <h1
            style={{
              fontSize: '40px',
              fontWeight: 600,
              marginBottom: '32px',
              color: '#111111',
            }}
          >
            {t('title')}
          </h1>

          <p
            style={{
              fontSize: '16px',
              color: '#4A4A4A',
              lineHeight: 1.6,
              marginBottom: '48px',
            }}
          >
            {t('systemWindows')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '48px',
            }}
          >
            <DownloadCard title={t('clientTitle')} url={INSTALLERS.client.url} />
            <DownloadCard title={t('agentTitle')} url={INSTALLERS.agent.url} />
          </div>

          {/* The Ideal Path Section */}
          <div className="bg-white rounded-2xl p-8 md:p-10 border border-gray-200 shadow-sm mb-12">
            <h2 className="text-xl font-bold text-gorka-dark mb-8">
              {t('pathTitle')}
            </h2>
            <div className="space-y-6">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#F01428]/10 flex items-center justify-center text-[#F01428] shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gorka-dark text-base">
                        {index + 1}. {step.title}
                      </h3>
                      <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <h2
            style={{
              fontSize: '22px',
              fontWeight: 600,
              marginBottom: '16px',
              color: '#111111',
            }}
          >
            {t('installStepsTitle')}
          </h2>
          <ol
            style={{
              fontSize: '15px',
              color: '#4A4A4A',
              lineHeight: 1.8,
              paddingLeft: '20px',
              marginBottom: '40px',
            }}
          >
            <li>{t('installStep1')}</li>
            <li>{t('installStep2')}</li>
            <li>{t('installStep3')}</li>
            <li>{t('installStep4')}</li>
            <li>{t('installStep5')}</li>
          </ol>

          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#FEF9C3',
              border: '1px solid #FDE047',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#713F12',
              lineHeight: 1.6,
              marginBottom: '40px',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '6px' }}>
              {t('smartScreenTitle')}
            </strong>
            {t('smartScreenBody')}
          </div>

          <h2
            style={{
              fontSize: '22px',
              fontWeight: 600,
              marginBottom: '16px',
              color: '#111111',
            }}
          >
            {t('requirementsTitle')}
          </h2>
          <ul
            style={{
              fontSize: '15px',
              color: '#4A4A4A',
              lineHeight: 1.8,
              paddingLeft: '20px',
              marginBottom: '40px',
            }}
          >
            <li>{t('requirement1')}</li>
            <li>{t('requirement2')}</li>
            <li>{t('requirement3')}</li>
          </ul>

          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#F3F4F6',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#4A4A4A',
              lineHeight: 1.6,
              marginBottom: '40px',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '6px' }}>
              {t('tipTitle')}
            </strong>
            {t('tipBody')}
          </div>

          <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center' }}>
            {t('needHelp')}{' '}
            <Link
              href="/contact"
              style={{ color: '#F01428', textDecoration: 'none', fontWeight: 500 }}
            >
              {t('contactUs')}
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

function DownloadCard({ title, url }: { title: string; url: string }) {
  return (
    <div
      style={{
        border: '1px solid #E3E3E3',
        borderRadius: '10px',
        padding: '40px 24px',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <a
        href={url}
        download
        aria-label={title}
        style={{ display: 'inline-block', marginBottom: '20px' }}
      >
        <Image
          src="/gorka-icon.png"
          alt="GORKA"
          width={96}
          height={96}
          style={{ display: 'block' }}
        />
      </a>
      <h3
        style={{
          fontSize: '18px',
          fontWeight: 600,
          margin: 0,
          color: '#111111',
        }}
      >
        {title}
      </h3>
    </div>
  );
}