import express from 'express';
import { config } from './config/index.ts';
import { requestLogger } from './middleware/redactionLogger.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { healthRouter } from './api/health.ts';
import { authRouter } from './api/authRoutes.ts';
import { workspaceRouter } from './api/workspaceRoutes.ts';
import { itemRouter } from './api/itemRoutes.ts';
import { sharingRouter } from './api/sharingRoutes.ts';
import { accountRouter } from './api/accountRoutes.ts';
import { adapterRouter } from './api/adapterRoutes.ts';

export function createApp() {
  const app = express();

  // Standard middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Security headers & CORS
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    const reqOrigin = req.headers.origin;
    if (config.CORS_ORIGIN === '*' || !config.CORS_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin || '*');
    } else if (reqOrigin && (reqOrigin === config.CORS_ORIGIN || reqOrigin.endsWith('.vercel.app') || reqOrigin.startsWith('http://localhost:'))) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', config.CORS_ORIGIN);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-Match');

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Zero-secret request logger
  app.use(requestLogger);

  // Mount API routes
  app.use(config.API_PREFIX, healthRouter);
  app.use(config.API_PREFIX, authRouter);
  app.use(config.API_PREFIX, workspaceRouter);
  app.use(config.API_PREFIX, itemRouter);
  app.use(config.API_PREFIX, sharingRouter);
  app.use(config.API_PREFIX, accountRouter);
  app.use(config.API_PREFIX, adapterRouter);

  // Central error handler
  app.use(errorHandler);

  return app;
}
