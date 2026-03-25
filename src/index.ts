import { BluetifyApp } from './app/index.js';
import { loadConfig } from './config/index.js';
import { logger } from './core/index.js';
import { BlueskyService } from './integrations/bluesky/index.js';

let app: BluetifyApp | null = null;

async function shutdown(): Promise<void> {
  if (!app) {
    process.exit(0);
  }

  try {
    await app.shutdown();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  const config = loadConfig();
  app = new BluetifyApp(config, new BlueskyService(config));
  await app.initialize();
  await app.start();
} catch (error) {
  logger.error('failed to start:', error, 'bootstrap');
  process.exit(1);
}
