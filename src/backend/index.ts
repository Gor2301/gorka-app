import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './config/logger';

// Import routes
import authRoutes from './routes/auth';
import debtorRoutes from './routes/debtors';
import actionRoutes from './routes/actions';
import communicationRoutes from './routes/communications';
import templateRoutes from './routes/templates';
import copilotRoutes from './routes/copilot.routes';

// Super Admin Routes
import superAdminAuthRoutes from './super-admin/routes/auth.routes';
import superAdminClientsRoutes from './super-admin/routes/clients.routes';
import superAdminAnalyticsRoutes from './super-admin/routes/analytics.routes';
import superAdminAuditRoutes from './super-admin/routes/audit.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5555',
    'https://gorka-super-admin.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// MAIN API ROUTES
// ============================================

// Authentication
app.use('/api/auth', authRoutes);

// Core Resources
app.use('/api/debtors', debtorRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/templates', templateRoutes);

// AI Copilot
app.use('/api/copilot', copilotRoutes);

// ============================================
// SUPER ADMIN API ROUTES (v1)
// ============================================

// Super Admin Authentication
app.use('/api/v1/admin/auth', superAdminAuthRoutes);

// Super Admin Client Management
app.use('/api/v1/admin/clients', superAdminClientsRoutes);

// Super Admin Analytics
app.use('/api/v1/admin/analytics', superAdminAnalyticsRoutes);

// Super Admin Audit Logs
app.use('/api/v1/admin/audit', superAdminAuditRoutes);

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// ============================================
// Error Handler
// ============================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
  logger.info(`🚀 GORKA Application initialized`);
  logger.info(`🚀 Express server running on http://localhost:${PORT}`);
  logger.info(`📚 Swagger docs available at http://localhost:${PORT}/api/docs`);
  logger.info(`🤖 Copilot available at http://localhost:${PORT}/api/copilot/health`);
});

export default app;