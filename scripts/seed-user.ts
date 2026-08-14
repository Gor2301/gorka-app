// scripts/seed-user.ts
import 'dotenv/config';
import { prisma } from '../src/backend/database';
import { randomUUID } from 'crypto';

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // Check if organization exists
    let org = await prisma.organization.findFirst();
    
    if (!org) {
      console.log('📝 Creating organization...');
      org = await prisma.organization.create({
        data: {
          name: 'GORKA Collections',
        },
      });
      console.log(`✅ Organization created: ${org.name} (${org.id})`);
    } else {
      console.log(`✅ Organization found: ${org.name} (${org.id})`);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: 'admin@gorka.local' },
    });

    if (existingUser) {
      console.log(`✅ User already exists: ${existingUser.name} (${existingUser.id})`);
      return;
    }

    // Create user with explicit UUID
    console.log('📝 Creating admin user...');
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'admin@gorka.local',
        password: 'password123',
        name: 'Admin User',
        role: 'ADMIN',
        organizationId: org.id,
        isActive: true,
      },
    });

    console.log(`✅ User created:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);

    console.log('\n🎉 Seeding complete!');
    console.log('🔑 Login credentials:');
    console.log(`   Email: admin@gorka.local`);
    console.log(`   Password: password123`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();