// prisma/seed-connectors.ts
//
// Seeds connector_catalog with prototype connectors, one row per
// provider capability. Idempotent: uses upsert, safe to re-run.
//
// Run with:
//   npx tsx prisma/seed-connectors.ts
//
// Does not touch any other table. Does not reference the stale
// prisma/seed.ts file.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const connectors = [
  {
    code: 'twilio-sms',
    mvpStatus: 'LIVE',
    name: 'Twilio SMS',
    description: 'Send SMS through Twilio.',
    category: 'SMS',
    provider: 'Twilio',
    isManagedByGorka: true,
    isActive: true,
    lifecycleStatus: 'ACTIVE',
    pricingModel: 'PASS_THROUGH',
    pricingConfig: { currency: 'USD', unitLabel: 'message', markupPercent: 0 },
    iconUrl: null,
    documentationUrl: 'https://www.twilio.com/docs/messaging',
    credentialSchema: {
      credentials: [
        { name: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'AC...' },
        { name: 'authToken', label: 'Auth Token', type: 'password', required: true },
      ],
      configuration: [
        { name: 'from', label: 'From number', type: 'tel', required: true, placeholder: '+1...' },
      ],
    },
  },
  {
    code: 'twilio-voice',
    mvpStatus: 'COMING_SOON',
    name: 'Twilio Voice',
    description: 'Place voice calls through Twilio.',
    category: 'VOICE',
    provider: 'Twilio',
    isManagedByGorka: true,
    isActive: true,
    lifecycleStatus: 'ACTIVE',
    pricingModel: 'PASS_THROUGH',
    pricingConfig: { currency: 'USD', unitLabel: 'minute', markupPercent: 0 },
    iconUrl: null,
    documentationUrl: 'https://www.twilio.com/docs/voice',
    credentialSchema: {
      credentials: [
        { name: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'AC...' },
        { name: 'authToken', label: 'Auth Token', type: 'password', required: true },
      ],
      configuration: [
        { name: 'from', label: 'From number', type: 'tel', required: true, placeholder: '+1...' },
      ],
    },
  },
  {
    code: 'resend-email',
    mvpStatus: 'LIVE',
    name: 'Resend Email',
    description: 'Send transactional and bulk email through Resend.',
    category: 'EMAIL',
    provider: 'Resend',
    isManagedByGorka: true,
    isActive: true,
    lifecycleStatus: 'ACTIVE',
    pricingModel: 'PASS_THROUGH',
    pricingConfig: { currency: 'USD', unitLabel: 'email', markupPercent: 0 },
    iconUrl: null,
    documentationUrl: 'https://resend.com/docs',
    credentialSchema: {
      credentials: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 're_...' },
      ],
      configuration: [
        { name: 'from', label: 'From address', type: 'email', required: true, default: 'onboarding@resend.dev' },
      ],
    },
  },
  {
    code: 'mocean-sms',
    mvpStatus: 'LIVE',
    name: 'Mocean SMS',
    description: 'Send SMS through Mocean for regional coverage.',
    category: 'SMS',
    provider: 'Mocean',
    isManagedByGorka: true,
    isActive: true,
    lifecycleStatus: 'ACTIVE',
    pricingModel: 'PASS_THROUGH',
    pricingConfig: { currency: 'USD', unitLabel: 'message', markupPercent: 0 },
    iconUrl: null,
    documentationUrl: 'https://www.moceanapi.com/docs',
    credentialSchema: {
      credentials: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
      ],
      configuration: [
        { name: 'from', label: 'Sender name', type: 'text', required: true, default: 'GORKA' },
      ],
    },
  },
  {
    code: 'gemini-ai',
    mvpStatus: 'COMING_SOON',
    name: 'Gemini AI',
    description: 'AI completion, analysis, and recommendations.',
    category: 'AI',
    provider: 'Google',
    isManagedByGorka: true,
    isActive: true,
    lifecycleStatus: 'ACTIVE',
    pricingModel: 'PASS_THROUGH',
    pricingConfig: { currency: 'USD', unitLabel: 'token', markupPercent: 0 },
    iconUrl: null,
    documentationUrl: 'https://ai.google.dev/docs',
    credentialSchema: {
      credentials: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true },
      ],
      configuration: [],
    },
  },
  {
    code: 'custom-api',
    mvpStatus: 'LIVE',
    name: 'Custom API',
    description: 'Connect any HTTP API using your own credentials.',
    category: 'DATA',
    provider: 'Your provider',
    isManagedByGorka: false,
    isActive: true,
    lifecycleStatus: 'ACTIVE',
    pricingModel: 'PASS_THROUGH',
    pricingConfig: { currency: 'USD', unitLabel: 'request', markupPercent: 0 },
    iconUrl: null,
    documentationUrl: null,
    // credentialSchema intentionally omitted (F13, Step 1).
    // custom-api has no adapter; nothing sends. It stays hidden
    // until Step 1.5 gives it a generic HTTP adapter. The ?? null
    // in the update block clears any schema left on the row.
  },
];

async function main() {
  console.log('Seeding connector_catalog...');
  for (const c of connectors) {
    await prisma.connectorCatalog.upsert({
      where: { code: c.code },
      create: c,
      update: {
        name: c.name,
        description: c.description,
        category: c.category,
        provider: c.provider,
        isManagedByGorka: c.isManagedByGorka,
        mvpStatus: c.mvpStatus,
        isActive: c.isActive,
        lifecycleStatus: c.lifecycleStatus,
        pricingModel: c.pricingModel,
        pricingConfig: c.pricingConfig,
        iconUrl: c.iconUrl,
        documentationUrl: c.documentationUrl,
        credentialSchema: c.credentialSchema ?? null,
      },
    });
    console.log(`  ✓ ${c.code}`);
  }
  console.log(`Done. ${connectors.length} connectors seeded.`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());