// test-communication.ts
// Run with: npx ts-node test-communication.ts

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// --- Setup Prisma with Adapter ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testStep2() {
  console.log('🧪 Testing Database Connection\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Check database connection
    console.log('\n📝 Test 1: Check database connection');
    
    const templateCount = await prisma.template.count();
    console.log(`✅ Database connected!`);
    console.log(`   Templates in database: ${templateCount}`);

    // Test 2: Get a user
    console.log('\n📝 Test 2: Get a user');
    
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No user found. Please create a user in Prisma Studio first.');
      console.log('   Run: npx prisma studio');
      return;
    }
    console.log(`✅ Found user: ${user.name} (${user.id})`);

    // Test 3: Create a template with the real user ID
    console.log('\n📝 Test 3: Create a template');
    
    const template = await prisma.template.create({
      data: {
        name: 'test_direct',
        channel: 'email',
        subject: 'Test Subject',
        content: 'Test Content',
        category: 'reminder',
        description: 'Direct test template',
        createdBy: user.id,
        version: 1,
        isActive: true,
      },
    });
    
    console.log('✅ Template created:');
    console.log(`   ID: ${template.id}`);
    console.log(`   Name: ${template.name}`);

    // Test 4: Get a debtor
    console.log('\n📝 Test 4: Get a debtor');
    
    let debtor = await prisma.debtor.findFirst();
    if (!debtor) {
      console.log('⚠️  No debtor found. Creating one...');
      
      debtor = await prisma.debtor.create({
        data: {
          name: 'Test Debtor',
          email: 'test@example.com',
          phone: '+63 912 345 6789',
          address: '123 Test St',
          organizationId: user.organizationId,
          createdBy: user.id,
        },
      });
      console.log('✅ Test debtor created');
    }
    
    console.log(`✅ Debtor found: ${debtor.name} (${debtor.id})`);

    // Test 5: Create a message log
    console.log('\n📝 Test 5: Create a message log');
    
    const log = await prisma.messageLog.create({
      data: {
        debtorId: debtor.id,
        channel: 'email',
        recipient: debtor.email || 'test@example.com',
        content: 'Test content',
        contentPreview: 'Test preview',
        status: 'QUEUED',
        provider: 'resend',
        userId: user.id,
        metadata: { test: true },
      },
    });
    
    console.log('✅ Message log created:');
    console.log(`   ID: ${log.id}`);
    console.log(`   Status: ${log.status}`);

    // Test 6: Create a message event
    console.log('\n📝 Test 6: Create a message event');
    
    const event = await prisma.messageEvent.create({
      data: {
        messageLogId: log.id,
        event: 'queued',
        data: { timestamp: new Date().toISOString() },
      },
    });
    
    console.log('✅ Message event created:');
    console.log(`   Event: ${event.event}`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Database tests passed!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Database connection: Working`);
    console.log(`   ✅ Template created: ${template.name}`);
    console.log(`   ✅ Message log created: ${log.id}`);
    console.log(`   ✅ Message event created: ${event.event}`);
    console.log('\n🚀 Ready for Step 3: Email Adapter (Resend)');

  } catch (error: any) {
    console.error('\n❌ Error during testing:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testStep2();