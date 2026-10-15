// prisma/seed-owner.ts
//
// Bootstrap the platform OWNER account.
//
// Usage:
//   npx tsx prisma/seed-owner.ts <email> <password>
//
// Effects:
//   - If no user with that email: creates one with
//     role='OWNER', isActive=true, no organizationId.
//   - If a user exists: sets role='OWNER', overwrites
//     the password, sets isActive=true.
//   - Password must be at least 8 characters.
//
// Slice 8.7 (Part V.7). Run once per environment.
// No unauthenticated bootstrap endpoint exists.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Usage: npx tsx prisma/seed-owner.ts <email> <password>');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'OWNER',
        passwordHash,
        isActive: true,
      },
    });
    console.log(`Updated existing user ${email} -> role=OWNER`);
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'OWNER',
        isActive: true,
        organizationId: null,
      },
    });
    console.log(`Created OWNER user ${created.email} (id=${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error('seed-owner failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });