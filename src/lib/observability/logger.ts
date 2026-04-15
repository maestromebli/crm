type LogLevel = "info" | "warn" | "error";

type LogInput = {
  message: string;
  module: string;
  requestId?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
};

function write(level: LogLevel, input: LogInput) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    module: input.module,
    message: input.message,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    details: input.details ?? null,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(input: LogInput) {
  write("info", input);
}

export function logWarn(input: LogInput) {
  write("warn", input);
}

export function logError(input: LogInput) {
  write("error", input);
}

