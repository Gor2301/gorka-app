// test-email.mjs
// Run with: node test-email.mjs

import 'dotenv/config';
import { Resend } from 'resend';

async function testResend() {
  console.log('🧪 Testing Resend API\n');
  console.log('='.repeat(50));

  try {
    // Check API key
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('❌ RESEND_API_KEY not found in .env file');
      console.log('   Add: RESEND_API_KEY=re_xxxxxxxxxxxx');
      return;
    }
    console.log('✅ Resend API key found');

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    console.log(`✅ From email: ${fromEmail}`);

    // --- Test 1: Test connection ---
    console.log('\n📝 Test 1: Test Resend connection');
    
    const resend = new Resend(apiKey);
    const domains = await resend.domains.list();
    
    if (domains.error) {
      console.log(`❌ Connection failed: ${domains.error.message}`);
      return;
    }
    console.log('✅ Connection successful!');
    console.log(`   Domains: ${domains.data?.data?.length || 0} domains found`);

    // --- Test 2: Send a test email ---
    console.log('\n📝 Test 2: Send test email');
    
    const recipient = process.env.TEST_EMAIL || 'delivered@resend.dev';
    console.log(`   Recipient: ${recipient}`);

    const response = await resend.emails.send({
      from: fromEmail,
      to: [recipient],
      subject: '🧪 GORKA Test Email',
      html: `
        <h1>🧪 GORKA Test Email</h1>
        <p>This is a test email from GORKA.</p>
        <p>If you're reading this, the email adapter is working correctly!</p>
        <hr/>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
      text: `GORKA Test Email\n\nThis is a test email from GORKA.\n\nIf you're reading this, the email adapter is working correctly!\n\nSent at: ${new Date().toISOString()}`,
    });

    if (response.error) {
      console.log(`❌ Email send failed: ${response.error.message}`);
      return;
    }

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${response.data?.id}`);
    console.log(`   To: ${recipient}`);

    // --- Summary ---
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Step 3 Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ API Key: Valid`);
    console.log(`   ✅ Connection: Working`);
    console.log(`   ✅ Test Email: Sent (ID: ${response.data?.id})`);
    console.log('\n🚀 Email adapter is ready for production use!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

testResend();