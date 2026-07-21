const APP_PREFIX = '[bluetify]';

function formatScope(scope?: string): string {
  const prefix = scope ? `${APP_PREFIX} [${scope}]` : APP_PREFIX;
  return `${new Date().toISOString()} ${prefix}`;
}

export const logger = {
  info(message: string, scope?: string): void {
    console.log(`${formatScope(scope)} ${message}`);
  },
  warn(message: string, scope?: string): void {
    console.warn(`${formatScope(scope)} ${message}`);
  },
  error(message: string, details?: unknown, scope?: string): void {
    if (details === undefined) {
      console.error(`${formatScope(scope)} ${message}`);
      return;
    }

    const normalized = details instanceof Error
      ? details.stack ?? details.message
      : details;
    console.error(`${formatScope(scope)} ${message}`, normalized);
  },
};
