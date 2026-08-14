// src/backend/database.ts
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

export const prisma = new PrismaClient();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});