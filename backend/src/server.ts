import { createApp } from './app.ts';
import { config } from './config/index.ts';
import { getDatabase } from './db/connection.ts';
import { logger } from './middleware/redactionLogger.ts';

async function bootstrap() {
  // Initialize and migrate database
  getDatabase();

  const app = createApp();

  app.listen(config.PORT, () => {
    logger.info(`VaultShare Backend running on http://localhost:${config.PORT}${config.API_PREFIX}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
