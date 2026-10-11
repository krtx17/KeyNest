import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDatabase } from '../db/connection.ts';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    // Verify database connectivity
    const result = db.queryOne<{ test: number }>('SELECT 1 as test');
    const isDbHealthy = result?.test === 1;

    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? 'healthy' : 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: isDbHealthy ? 'connected' : 'disconnected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: 'error',
      },
    });
  }
});
