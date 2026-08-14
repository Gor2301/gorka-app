"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
// src/backend/database.ts
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
require("dotenv/config");
// Create the pool once
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
// Create the adapter once
const adapter = new adapter_pg_1.PrismaPg(pool);
// Create PrismaClient WITH adapter — export this single instance
exports.prisma = new client_1.PrismaClient({ adapter });
// Graceful shutdown
process.on('beforeExit', async () => {
    await exports.prisma.$disconnect();
    await pool.end();
});
