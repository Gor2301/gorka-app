import { prisma } from '../db';
import fs from 'fs';
import os from 'os';

export class HealthCheckService {
  /**
   * Perform a comprehensive health check of the system
   */
  static async check(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: {
      database: { status: 'ok' | 'error'; latency?: number; error?: string };
      disk: { status: 'ok' | 'error'; free: number; total: number; usedPercent: number };
      memory: { status: 'ok' | 'error'; free: number; total: number; usedPercent: number };
      uptime: number;
      version: string;
      environment: string;
      frontend: { status: 'ok' | 'error'; url: string };
      api: { status: 'ok' | 'error'; url: string };
    };
  }> {
    const checks: any = {
      database: { status: 'error' as const },
      disk: { status: 'error' as const },
      memory: { status: 'error' as const },
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      frontend: { status: 'error' as const },
      api: { status: 'error' as const },
    };

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // ─── Check Database ────────────────────────────────────────────
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      checks.database = { status: 'ok', latency };
    } catch (error: any) {
      checks.database = { status: 'error', error: error.message };
      overallStatus = 'unhealthy';
    }

    // ─── Check Disk Space ───────────────────────────────────────────
    try {
      const stats = fs.statfsSync('/');
      const free = stats.bavail * stats.bsize;
      const total = stats.blocks * stats.bsize;
      const usedPercent = ((total - free) / total) * 100;
      checks.disk = {
        status: usedPercent > 90 ? 'error' : 'ok',
        free,
        total,
        usedPercent,
      };
      if (usedPercent > 90) {
        overallStatus = 'degraded';
      }
    } catch (error: any) {
      checks.disk = { status: 'error', error: error.message };
      overallStatus = 'degraded';
    }

    // ─── Check Memory ──────────────────────────────────────────────
    try {
      const total = os.totalmem();
      const free = os.freemem();
      const usedPercent = ((total - free) / total) * 100;
      checks.memory = {
        status: usedPercent > 90 ? 'error' : 'ok',
        free,
        total,
        usedPercent,
      };
      if (usedPercent > 90) {
        overallStatus = 'degraded';
      }
    } catch (error: any) {
      checks.memory = { status: 'error', error: error.message };
      overallStatus = 'degraded';
    }

    // ─── Check Frontend URL ────────────────────────────────────────
    // ✅ CRITICAL: No fallback — fail if FRONTEND_URL is missing
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      checks.frontend = { status: 'error', error: 'FRONTEND_URL not set' };
      overallStatus = 'degraded';
    } else {
      try {
        const response = await fetch(frontendUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        checks.frontend = {
          status: response.ok ? 'ok' : 'error',
          url: frontendUrl,
          ...(response.ok ? {} : { error: `HTTP ${response.status}` }),
        };
        if (!response.ok) {
          overallStatus = 'degraded';
        }
      } catch (error: any) {
        checks.frontend = { status: 'error', url: frontendUrl, error: error.message };
        overallStatus = 'degraded';
      }
    }

    // ─── Check API URL ─────────────────────────────────────────────
    // ✅ CRITICAL: No fallback — fail if API_URL is missing
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      checks.api = { status: 'error', error: 'API_URL not set' };
      overallStatus = 'degraded';
    } else {
      try {
        const response = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
        checks.api = {
          status: response.ok ? 'ok' : 'error',
          url: apiUrl,
          ...(response.ok ? {} : { error: `HTTP ${response.status}` }),
        };
        if (!response.ok) {
          overallStatus = 'degraded';
        }
      } catch (error: any) {
        checks.api = { status: 'error', url: apiUrl, error: error.message };
        overallStatus = 'degraded';
      }
    }

    // ─── Final Status ──────────────────────────────────────────────
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Quick health check for load balancers
   */
  static async quick(): Promise<{ status: 'ok' | 'error' }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }
}