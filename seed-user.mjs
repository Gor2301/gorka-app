// seed-user.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find the organization
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.log('❌ No organization found. Create one in Prisma Studio first.');
    return;
  }

  // Create the user
  const user = await prisma.user.create({
    data: {
      email: 'admin@gorka.local',
      password: 'password123',
      name: 'Admin User',
      role: 'ADMIN',
      organizationId: org.id,
      isActive: true,
    },
  });

  console.log('✅ User created:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Email: ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());