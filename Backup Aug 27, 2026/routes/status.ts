import express from 'express';
import { getPool } from '../db';
import { HealthCheckService } from '../services/HealthCheckService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// GET /api/status - Get current status
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;
    const organizationId = user.organizationId;
    const pool = getPool();

    let result = await pool.query(
      `SELECT * FROM "ServiceStatus" 
       WHERE "organizationId" = $1`,
      [organizationId]
    );
    
    let statuses = result.rows;

    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    const staleServices = statuses.filter((s: any) => new Date(s.lastCheck) < staleThreshold);

    if (staleServices.length > 0 || statuses.length === 0) {
      const healthService = new HealthCheckService(organizationId);
      const freshStatuses = await healthService.checkAll();
      await healthService.saveStatuses(freshStatuses);

      result = await pool.query(
        `SELECT * FROM "ServiceStatus" 
         WHERE "organizationId" = $1`,
        [organizationId]
      );
      statuses = result.rows;
    }

    return res.json({
      status: 'ok',
      data: statuses,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/status/check - Manual refresh (Admin only)
router.post('/check', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;
    
    if (!['ADMIN', 'SUPERVISOR'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const healthService = new HealthCheckService(user.organizationId);
    const statuses = await healthService.checkAll();
    await healthService.saveStatuses(statuses);

    return res.json({
      status: 'ok',
      data: statuses,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error refreshing status:', error);
    return res.status(500).json({ 
      error: 'Failed to refresh status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/status/history - Get status history (last 24h)
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;
    const { service } = req.query;
    const pool = getPool();

    let query = `SELECT * FROM "StatusHistory" 
                 WHERE "organizationId" = $1 
                 AND "recordedAt" > NOW() - INTERVAL '24 hours'`;
    const params: any[] = [user.organizationId];

    if (service) {
      query += ` AND "serviceName" = $2`;
      params.push(service);
    }

    query += ` ORDER BY "recordedAt" DESC LIMIT 100`;

    const result = await pool.query(query, params);

    return res.json({
      status: 'ok',
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;