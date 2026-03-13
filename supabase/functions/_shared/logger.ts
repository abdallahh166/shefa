type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    data: data ?? {},
    ts: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const logInfo = (message: string, data?: Record<string, unknown>) => log("info", message, data);
export const logWarn = (message: string, data?: Record<string, unknown>) => log("warn", message, data);
export const logError = (message: string, data?: Record<string, unknown>) => log("error", message, data);
