import "server-only";

/** Cloud Logging compatible severity (JSON `severity` field). */
export type LogSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export type LogContext = Record<
  string,
  string | number | boolean | null | undefined
>;

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(error.stack ? { errorStack: error.stack } : {}),
    };
  }
  return { errorMessage: String(error) };
}

function write(
  severity: LogSeverity,
  message: string,
  context?: LogContext,
  error?: unknown,
): void {
  const payload: Record<string, unknown> = {
    severity,
    message,
    ...context,
    ...(error !== undefined ? serializeError(error) : {}),
  };
  const line = JSON.stringify(payload);
  if (severity === "ERROR") {
    console.error(line);
  } else if (severity === "WARNING") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** Structured logger for Cloud Run → Cloud Logging (#29 follow-up). */
export const logger = {
  debug(message: string, context?: LogContext): void {
    write("DEBUG", message, context);
  },
  info(message: string, context?: LogContext): void {
    write("INFO", message, context);
  },
  warn(message: string, context?: LogContext, error?: unknown): void {
    write("WARNING", message, context, error);
  },
  error(message: string, context?: LogContext, error?: unknown): void {
    write("ERROR", message, context, error);
  },
};
