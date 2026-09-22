// prisma/seed-plans.ts
//
// Seeds default plan tier pricing into platform_settings.
// Idempotent: uses upsert on the `key` unique field.
//
// Run with:
//   npx tsx prisma/seed-plans.ts
//
// The values here are DEFAULTS. They can be changed at any time
// by updating the platform_settings row. The License row for each
// organization stores the actual agreed price — which may differ
// from these defaults if a discount was granted.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  { tier: 'FREE',         price: 0,     currency: 'USD', renewalCycle: 'MONTHLY' },
  { tier: 'PROFESSIONAL', price: 2000,  currency: 'USD', renewalCycle: 'MONTHLY' },
  { tier: 'ENTERPRISE',   price: 10000, currency: 'USD', renewalCycle: 'MONTHLY' },
];

async function main() {
  console.log('Seeding platform_settings plan defaults...');
  await prisma.platformSettings.upsert({
    where: { key: 'plans' },
    create: { key: 'plans', value: { tiers: plans } },
    update: { value: { tiers: plans } },
  });
  console.log('  ✓ plans');
  console.log('Done. 3 plan tiers seeded.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());