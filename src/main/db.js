"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getPool = getPool;
const pg_1 = require("pg");
const fs_1 = __importDefault(require("fs"));
const logFile = 'C:\\Users\\kucha\\gorka-app\\startup.log';
// Connection pool
let pool = null;
let isInitialized = false;
// Database connection string
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/gorka';
function log(message) {
    console.log(message);
    try {
        fs_1.default.appendFileSync(logFile, message + '\n');
    }
    catch (err) {
        // Ignore
    }
}
async function initDatabase() {
    if (isInitialized && pool)
        return pool;
    try {
        log('🔄 Connecting to PostgreSQL...');
        pool = new pg_1.Pool({
            connectionString: DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        const client = await pool.connect();
        log('✅ PostgreSQL connected successfully');
        client.release();
        // Create tables
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "Organization" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        "organizationId" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("organizationId") REFERENCES "Organization"(id)
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "Debtor" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        country TEXT,
        "organizationId" UUID NOT NULL,
        "assignedToId" UUID,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("organizationId") REFERENCES "Organization"(id),
        FOREIGN KEY ("assignedToId") REFERENCES "User"(id)
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "Debt" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        description TEXT,
        "dueDate" TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE',
        "debtorId" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("debtorId") REFERENCES "Debtor"(id)
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "Action" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        priority INTEGER DEFAULT 1,
        status TEXT DEFAULT 'PENDING',
        "assignedToId" UUID NOT NULL,
        "debtorId" UUID NOT NULL,
        "debtId" UUID,
        "dueDate" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("assignedToId") REFERENCES "User"(id),
        FOREIGN KEY ("debtorId") REFERENCES "Debtor"(id),
        FOREIGN KEY ("debtId") REFERENCES "Debt"(id)
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "Interaction" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        channel TEXT,
        subject TEXT,
        content TEXT NOT NULL,
        direction TEXT DEFAULT 'OUTGOING',
        "debtorId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("debtorId") REFERENCES "Debtor"(id),
        FOREIGN KEY ("userId") REFERENCES "User"(id)
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "Document" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "fileName" TEXT NOT NULL,
        "filePath" TEXT NOT NULL,
        "fileType" TEXT NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "debtorId" UUID NOT NULL,
        "uploadedById" UUID NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("debtorId") REFERENCES "Debtor"(id),
        FOREIGN KEY ("uploadedById") REFERENCES "User"(id)
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "User"(id)
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "JobQueue" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        payload TEXT,
        result TEXT,
        error TEXT,
        "lockedAt" TIMESTAMP,
        "processedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_action_assigned_status ON "Action"("assignedToId", status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_jobqueue_status_locked ON "JobQueue"(status, "lockedAt")`);
        isInitialized = true;
        log('✅ PostgreSQL database initialized with all tables');
        return pool;
    }
    catch (error) {
        log(`❌ PostgreSQL initialization failed: ${error}`);
        throw error;
    }
}
function getPool() {
    if (!pool) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return pool;
}
exports.default = { initDatabase, getPool };
//# sourceMappingURL=db.js.map