// scripts/seed-admin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding admin user...');

  // Find or create organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    console.log('📁 No organization found. Creating default...');
    org = await prisma.organization.create({
      data: { name: 'GORKA Collections' }
    });
    console.log(`✅ Organization created: ${org.name} (${org.id})`);
  } else {
    console.log(`📁 Organization found: ${org.name} (${org.id})`);
  }

  // Hash password
  const passwordHash = await bcrypt.hash('password123', 10);
  console.log('🔐 Password hashed');

  // Create admin user
  const user = await prisma.user.upsert({
    where: { email: 'admin@gorka.local' },
    update: { 
      password: passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      organizationId: org.id,
      isActive: true,
    },
    create: {
      email: 'admin@gorka.local',
      password: passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
      organizationId: org.id,
      isActive: true,
    },
  });

  console.log(`✅ Admin user created: ${user.email} (${user.id})`);
  console.log('🔑 Credentials: admin@gorka.local / password123');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());