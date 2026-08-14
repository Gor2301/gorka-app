// test-communication.js
// Run with: node test-communication.js

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the Prisma adapter
const adapter = new PrismaPg(pool);

// Create Prisma Client with the adapter
const prisma = new PrismaClient({ adapter });

// Import our services
const { templateService } = require('./src/backend/services/template.service');
const { messageLogService } = require('./src/backend/services/message-log.service');
const { communicationService } = require('./src/backend/services/communication.service');

// Override the Prisma client in services (temporary fix for testing)
// Note: In production, you'd inject this properly
const originalPrisma = require('@prisma/client');

async function testStep2() {
  console.log('🧪 Testing Step 2: Communication Services\n');
  console.log('='.repeat(50));

  try {
    // --- Test 1: Create a template ---
    console.log('\n📝 Test 1: Create a template');
    
    const template = await templateService.createTemplate({
      name: 'test_reminder',
      channel: 'email',
      subject: 'Test Reminder for {{debtor_name}}',
      content: `
        <h2>Hello {{debtor_name}},</h2>
        <p>Your payment of <strong>{{debt_amount}}</strong> is due on {{debt_due_date}}.</p>
        <p>Please contact {{collector_name}} at {{collector_phone}}.</p>
        <p>{{compliance_notice}}</p>
      `,
      category: 'reminder',
      description: 'Test template for Step 2 validation',
      createdBy: 'system',
    });

    console.log('✅ Template created:');
    console.log(`   ID: ${template.id}`);
    console.log(`   Name: ${template.name}`);
    console.log(`   Channel: ${template.channel}`);
    console.log(`   Version: ${template.version}`);

    // --- Test 2: Get a debtor ---
    console.log('\n📝 Test 2: Get a debtor');
    
    let debtor = await prisma.debtor.findFirst();
    let debtorId;

    if (!debtor) {
      console.log('⚠️  No debtor found. Creating a test debtor...');
      
      // Check if a user exists
      const user = await prisma.user.findFirst();
      if (!user) {
        console.log('❌ No user found. Please create a user first.');
        console.log('   Run: npx prisma studio and add a user.');
        return;
      }

      const newDebtor = await prisma.debtor.create({
        data: {
          name: 'Test Debtor',
          email: 'test@example.com',
          phone: '+63 912 345 6789',
          address: '123 Test St, Manila, Philippines',
          organizationId: user.organizationId,
          createdBy: user.id,
        },
      });
      
      console.log('✅ Test debtor created:');
      console.log(`   ID: ${newDebtor.id}`);
      console.log(`   Name: ${newDebtor.name}`);
      
      // Add a debt for this debtor
      await prisma.debt.create({
        data: {
          debtorId: newDebtor.id,
          amount: 15000.00,
          currency: 'PHP',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          reference: 'TEST-001',
        },
      });

      debtorId = newDebtor.id;
    } else {
      console.log('✅ Found debtor:');
      console.log(`   ID: ${debtor.id}`);
      console.log(`   Name: ${debtor.name}`);
      debtorId = debtor.id;
    }

    // --- Test 3: Render a template ---
    console.log('\n📝 Test 3: Render template with debtor data');
    
    const fullDebtor = await prisma.debtor.findUnique({
      where: { id: debtorId },
      include: { debts: true },
    });

    const rendered = await templateService.renderTemplate(
      'test_reminder',
      'email',
      fullDebtor,
      {
        collectorName: 'John Collector',
        collectorPhone: '+63 912 345 6789',
        collectorEmail: 'john@collector.com',
        organizationName: 'GORKA Collections',
        jurisdiction: 'ph',
      }
    );

    console.log('✅ Template rendered:');
    console.log(`   Subject: ${rendered.subject}`);
    console.log(`   HTML Preview: ${rendered.html.substring(0, 100)}...`);
    console.log(`   Text Preview: ${rendered.text.substring(0, 100)}...`);

    // --- Test 4: Create a message log ---
    console.log('\n📝 Test 4: Create a message log');
    
    const log = await messageLogService.createMessageLog({
      debtorId: debtorId,
      userId: 'system',
      channel: 'email',
      recipient: fullDebtor.email || 'test@example.com',
      subject: rendered.subject,
      content: rendered.html,
      contentPreview: rendered.text.slice(0, 200),
      templateId: template.id,
      templateName: template.name,
      templateVersion: template.version,
      templateSnapshot: template,
      status: 'QUEUED',
      provider: 'resend',
      metadata: { test: 'Step 2 validation' },
    });

    console.log('✅ Message log created:');
    console.log(`   ID: ${log.id}`);
    console.log(`   Status: ${log.status}`);
    console.log(`   Channel: ${log.channel}`);

    // --- Test 5: Get message log ---
    console.log('\n📝 Test 5: Retrieve message log with events');
    
    const retrievedLog = await messageLogService.getMessageLog(log.id);
    console.log('✅ Message log retrieved:');
    console.log(`   ID: ${retrievedLog.id}`);
    console.log(`   Events: ${retrievedLog.events.length}`);
    if (retrievedLog.events.length > 0) {
      console.log(`   First event: ${retrievedLog.events[0].event} at ${retrievedLog.events[0].timestamp}`);
    }

    // --- Test 6: Get statistics ---
    console.log('\n📝 Test 6: Get message statistics');
    
    const stats = await messageLogService.getStatistics({
      channel: 'email',
    });
    console.log('✅ Statistics retrieved:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Sent: ${stats.sent}`);
    console.log(`   Delivered: ${stats.delivered}`);
    console.log(`   Failed: ${stats.failed}`);

    // --- Summary ---
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Step 2 Test Complete! All services working.');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Template Service: Created and rendered template`);
    console.log(`   ✅ Message Log Service: Created and retrieved log`);
    console.log(`   ✅ Communication Service: All dependencies loaded`);
    console.log('\n🚀 Ready for Step 3: Email Adapter (Resend)');

  } catch (error) {
    console.error('\n❌ Error during testing:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testStep2();