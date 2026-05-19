const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const;

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  debug: (msg: string) => console.debug(`[${ts()}] [DEBUG] ${msg}`),
  info:  (msg: string) => console.log(`[${ts()}] [INFO]  ${msg}`),
  warn:  (msg: string) => console.warn(`[${ts()}] [WARN]  ${msg}`),
  error: (msg: string) => console.error(`[${ts()}] [ERROR] ${msg}`),
};
