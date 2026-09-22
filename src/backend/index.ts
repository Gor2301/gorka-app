import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import logger from './middleware/logger';
import boundaryRoutes from './routes/boundary.routes';
import connectorsRoutes from './routes/connectors.routes';
import connectorUsageRoutes from './routes/connector-usage.routes';
import billingRoutes from './routes/billing.routes';
import licensesRoutes from './routes/licenses.routes';

// Import routes
import authRoutes from './routes/auth';
import supportRoutes from './routes/support.routes';
import dashboardRoutes from './routes/dashboard.routes';
import metricsRoutes from './routes/metrics.routes';
import activityRoutes from './routes/activity.routes';

dotenv.config();

// ✅ CRITICAL: Fail fast if JWT_SECRET is missing
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set in environment variables');
  console.error('❌ Server will not start. Please set JWT_SECRET and restart.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  console.error('❌ Server will not start. Please set DATABASE_URL and restart.');
  process.exit(1);
}

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// ─── CORS Configuration ──────────────────────────────────────────────────
// ✅ FIX: Added production domains + tauri/app origins
const allowedOrigins = [
  // Production
  'https://www.gorka.click',
  'https://platform.gorka.click',
  'https://client.gorka.click',
  'https://gorka.click',
  // Development
  'http://gorka.localhost:3001',
  'http://platform.gorka.localhost:3002',
  'http://client.gorka.localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  // Tauri/Electron desktop apps
  'tauri://localhost',
  'app://localhost',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
}));

// ✅ Handle preflight requests explicitly


app.use(express.json());
app.use(cookieParser());
app.use(logger);

// ─── Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/support', authenticateToken, supportRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/metrics', authenticateToken, metricsRoutes);
app.use('/api/activity', authenticateToken, activityRoutes);
app.use('/api/boundary-proofs', authenticateToken, boundaryRoutes);
app.use('/api/connectors', authenticateToken, connectorsRoutes);
app.use('/api/connector-usage', authenticateToken, connectorUsageRoutes);
app.use('/api/billing', authenticateToken, billingRoutes);
app.use('/api/licenses', authenticateToken, licensesRoutes);


// ─── Health Check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── Forbidden Endpoint Blacklist (Production Only) ────────────────────
// ✅ FIX: Block debtor endpoints in production
const FORBIDDEN_ENDPOINTS = [
  '/api/debtors',
  '/api/debtors/*',
  '/api/communications',
  '/api/communications/*',
  '/api/notes',
  '/api/notes/*',
  '/api/actions',
  '/api/actions/*',
  '/api/debts',
  '/api/debts/*',
  '/api/search',
  '/api/reports',
  '/api/exports',
];

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const path = req.path;
    const isForbidden = FORBIDDEN_ENDPOINTS.some(pattern => {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      return regex.test(path);
    });
    if (isForbidden) {
      console.log(`🔴 BLOCKED: Forbidden endpoint accessed: ${path}`);
      return res.status(404).json({ error: 'Not Found' });
    }
  }
  return next();
});

// ─── Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
  console.log(`📚 API docs available at http://localhost:${PORT}/api/docs`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;