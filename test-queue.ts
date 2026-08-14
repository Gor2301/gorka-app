// test-queue.ts
// Run with: npx ts-node test-queue.ts

import 'dotenv/config';
import { prisma } from './src/backend/database';
import { communicationService } from './src/backend/services/communication.service';
import { messageWorker } from './src/backend/workers/message-worker';

async function testQueue() {
  console.log('🧪 Testing Message Queue\n');
  console.log('='.repeat(50));

  try {
    // --- Step 1: Initialize email adapter ---
    console.log('\n📝 Step 1: Initialize email adapter');
    
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      console.log('❌ RESEND_API_KEY not found in .env');
      return;
    }

    await communicationService.initializeEmailAdapter(apiKey);
    console.log('✅ Email adapter initialized');

    // --- Step 2: Get a debtor ---
    console.log('\n📝 Step 2: Get a debtor');
    
    let debtor = await prisma.debtor.findFirst();
    if (!debtor) {
      console.log('⚠️  No debtor found. Creating one...');
      
      const user = await prisma.user.findFirst();
      if (!user) {
        console.log('❌ No user found');
        return;
      }

      debtor = await prisma.debtor.create({
        data: {
          name: 'Queue Test Debtor',
          email: process.env.TEST_EMAIL || 'test@example.com',
          phone: '+63 912 345 6789',
          address: '123 Test St',
          organizationId: user.organizationId,
          createdBy: user.id,
        },
      });
      console.log('✅ Test debtor created');
    }
    
    console.log(`✅ Debtor: ${debtor.name} (${debtor.id})`);

    // --- Step 3: Create a template ---
    console.log('\n📝 Step 3: Create a template');
    
    let template = await prisma.template.findFirst({
      where: { name: 'queue_test' },
    });

    if (!template) {
      const user = await prisma.user.findFirst();
      if (!user) {
        console.log('❌ No user found');
        return;
      }

      template = await prisma.template.create({
        data: {
          name: 'queue_test',
          channel: 'email',
          subject: 'Queue Test for {{debtor_name}}',
          content: `
            <h2>Hello {{debtor_name}},</h2>
            <p>This is a test email sent through the queue system.</p>
            <p>Your payment of <strong>{{debt_amount}}</strong> is due on {{debt_due_date}}.</p>
            <p>{{compliance_notice}}</p>
            <hr/>
            <p><small>Sent at: {{current_date}}</small></p>
          `,
          category: 'reminder',
          description: 'Queue test template',
          createdBy: user.id,
          isActive: true,
        },
      });
      console.log('✅ Template created');
    }
    console.log(`✅ Template: ${template.name} (${template.id})`);

    // --- Step 4: Queue a message ---
    console.log('\n📝 Step 4: Queue a message');
    
    const recipient = process.env.TEST_EMAIL || debtor.email || 'test@example.com';
    
    const result = await communicationService.sendMessage({
      channel: 'email',
      recipient: recipient,
      templateName: template.name,
      debtorId: debtor.id,
      // userId is optional — removed to avoid foreign key error
      context: {
        collectorName: 'John Collector',
        collectorPhone: '+63 912 345 6789',
        collectorEmail: 'john@collector.com',
        organizationName: 'GORKA Collections',
        jurisdiction: 'ph',
        debt: {
          amount: 15000,
          currency: 'PHP',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    console.log('✅ Message queued:');
    console.log(`   Message Log ID: ${result.messageLogId}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Scheduled: ${result.scheduled || false}`);

    // --- Step 5: Check queue ---
    console.log('\n📝 Step 5: Check queue status');
    
    const pendingJobs = await prisma.jobQueue.count({
      where: {
        type: 'MESSAGE',
        status: 'PENDING',
      },
    });

    console.log(`   Pending jobs in queue: ${pendingJobs}`);

    // --- Step 6: Start worker ---
    console.log('\n📝 Step 6: Start worker');
    
    messageWorker.start();

    // --- Step 7: Wait for processing ---
    console.log('\n📝 Step 7: Waiting for processing...');
    console.log('   (Worker will process the queue in the background)');
    
    // Wait 10 seconds for processing
    await new Promise(resolve => setTimeout(resolve, 10000));

    // --- Step 8: Check results ---
    console.log('\n📝 Step 8: Check results');
    
    const completedJobs = await prisma.jobQueue.count({
      where: {
        type: 'MESSAGE',
        status: 'COMPLETED',
      },
    });

    const failedJobs = await prisma.jobQueue.count({
      where: {
        type: 'MESSAGE',
        status: 'FAILED',
      },
    });

    console.log(`   Completed jobs: ${completedJobs}`);
    console.log(`   Failed jobs: ${failedJobs}`);

    // Get the message log status
    const messageLog = await prisma.messageLog.findUnique({
      where: { id: result.messageLogId },
    });

    if (messageLog) {
      console.log(`   Message Status: ${messageLog.status}`);
      console.log(`   Provider ID: ${messageLog.providerMessageId || 'Not sent yet'}`);
    }

    // --- Summary ---
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Queue Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Email adapter: Initialized`);
    console.log(`   ✅ Template: ${template.name}`);
    console.log(`   ✅ Message queued: ${result.messageLogId}`);
    console.log(`   ✅ Worker running: ${messageWorker.getStatus().isRunning}`);
    console.log(`   📬 Processed: ${completedJobs + failedJobs} job(s)`);

    // Stop worker after test
    messageWorker.stop();

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testQueue();