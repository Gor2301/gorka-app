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
  },
  {
    code: 'twilio-voice',
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
  },
  {
    code: 'resend-email',
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
  },
  {
    code: 'mocean-sms',
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
  },
  {
    code: 'gemini-ai',
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
        isActive: c.isActive,
        lifecycleStatus: c.lifecycleStatus,
        pricingModel: c.pricingModel,
        pricingConfig: c.pricingConfig,
        iconUrl: c.iconUrl,
        documentationUrl: c.documentationUrl,
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