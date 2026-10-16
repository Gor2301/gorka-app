"use client";

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const VERSION = 'v0.1.0';

const INSTALLERS = {
  client: {
    url: '/downloads/gorka-client-setup.exe',
    filename: 'GORKA-Client-Setup.exe',
  },
  agent: {
    url: '/downloads/gorka-agent-setup.exe',
    filename: 'GORKA-Agent-Setup.exe',
  },
};

export default function DownloadPage() {
  const t = useTranslations('download');

  return (
    <>
      <Header />
      <main className="pt-16 md:pt-20">
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
              marginBottom: '8px',
              color: '#111111',
            }}
          >
            {t('title')}
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '32px' }}>
            {VERSION}
          </p>

          <p
            style={{
              fontSize: '16px',
              color: '#4A4A4A',
              lineHeight: 1.6,
              marginBottom: '40px',
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
            <DownloadCard
              title={t('clientTitle')}
              description={t('clientDescription')}
              url={INSTALLERS.client.url}
              label={t('clientButton')}
            />
            <DownloadCard
              title={t('agentTitle')}
              description={t('agentDescription')}
              url={INSTALLERS.agent.url}
              label={t('agentButton')}
            />
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

function DownloadCard({
  title,
  description,
  url,
  label,
}: {
  title: string;
  description: string;
  url: string;
  label: string;
}) {
  return (
    <div
      style={{
        border: '1px solid #E3E3E3',
        borderRadius: '10px',
        padding: '24px',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <Image
          src="/gorka-icon.png"
          alt="GORKA"
          width={56}
          height={56}
          style={{ marginBottom: '16px' }}
        />
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '8px',
            color: '#111111',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: '14px',
            color: '#6B7280',
            lineHeight: 1.6,
            marginBottom: '20px',
          }}
        >
          {description}
        </p>
      </div>
      <a
        href={url}
        download
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '12px 16px',
          backgroundColor: '#F01428',
          color: 'white',
          borderRadius: '6px',
          fontSize: '15px',
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        {label}
      </a>
    </div>
  );
}