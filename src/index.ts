import { BluetifyApp } from './app.js';

const app = new BluetifyApp();

async function shutdown(): Promise<void> {
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
  await app.initialize();
  await app.start();
} catch (error) {
  console.error('[bluetify] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
}
