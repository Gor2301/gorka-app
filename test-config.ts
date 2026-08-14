// test-config.ts
// Run with: npx ts-node test-config.ts

import 'dotenv/config';
import { getSenderEmail } from './src/backend/config/email.config';

console.log('🧪 Testing Email Config\n');
console.log('='.repeat(50));

console.log('\n📝 Checking configuration:');

const fromEmail = getSenderEmail();
console.log(`   From Email: ${fromEmail}`);

const apiKey = process.env.RESEND_API_KEY;
console.log(`   API Key: ${apiKey ? '✅ Found' : '❌ Missing'}`);

const testEmail = process.env.TEST_EMAIL;
console.log(`   Test Email: ${testEmail || '❌ Not set'}`);

console.log('\n' + '='.repeat(50));

if (fromEmail === 'onboarding@resend.dev') {
  console.log('✅ Configuration is correct! The sender email is the Resend test domain.');
  console.log('   This should work with Resend without verification.');
} else {
  console.log(`⚠️  Sender email is: ${fromEmail}`);
  console.log('   If this is not a verified domain, emails will fail.');
}

console.log('\n🚀 Ready to run test-queue.ts');