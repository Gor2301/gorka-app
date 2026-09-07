import { PrismaClient } from '@prisma/client';

// ✅ CRITICAL: No fallback — fail if DATABASE_URL is missing
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  console.error('❌ Database connection will fail. Please set DATABASE_URL and restart.');
  throw new Error('DATABASE_URL is not set');
}

// PrismaClient with connection URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

// Log connection status
prisma.$connect()
  .then(() => {
    console.log('✅ PostgreSQL connected successfully');
  })
  .catch((err) => {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  });

export { prisma, DATABASE_URL };