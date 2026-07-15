export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";

export interface EventvisorDiagnostic {
  level: LogLevel;
  code: string;
  message: string;
  details: Record<string, unknown>;
  moduleName?: string;
  error?: unknown;
}

export type EventvisorDiagnosticHandler = (diagnostic: EventvisorDiagnostic) => void;

export type LogMessage = string;

export interface LogDetails {
  [key: string]: any;
}

export type LogHandler = (level: LogLevel, message: LogMessage, details?: LogDetails) => void;

export interface CreateLoggerOptions {
  level?: LogLevel;
  handler?: LogHandler;
  onDiagnostic?: EventvisorDiagnosticHandler;
}

export const loggerPrefix = "[Eventvisor]";

export const defaultLogHandler: LogHandler = function defaultLogHandler(
  level,
  message,
  details = {},
) {
  let method = "log";

  if (level === "info") {
    method = "info";
  } else if (level === "warn") {
    method = "warn";
  } else if (level === "error") {
    method = "error";
  }

  console[method](loggerPrefix, message, details);
};

export class Logger {
  static allLevels: LogLevel[] = [
    "fatal",
    "error",
    "warn",
    "info",

    // not enabled by default
    "debug",
  ];

  static defaultLevel: LogLevel = "info";

  private level: LogLevel;
  private handle: LogHandler;
  private onDiagnostic?: EventvisorDiagnosticHandler;

  constructor(options: CreateLoggerOptions) {
    this.level = options.level || Logger.defaultLevel;
    this.handle = options.handler || defaultLogHandler;
    this.onDiagnostic = options.onDiagnostic;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  log(level: LogLevel, message: LogMessage, details?: LogDetails) {
    const diagnosticDetails = details || {};
    const code =
      typeof diagnosticDetails.code === "string"
        ? diagnosticDetails.code
        : message
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "");
    try {
      this.onDiagnostic?.({
        level,
        code,
        message,
        details: diagnosticDetails,
        error: diagnosticDetails.error,
        moduleName: diagnosticDetails.moduleName,
      });
    } catch (error) {
      this.handle("error", "Diagnostic handler failed", { error });
    }

    const shouldHandle = Logger.allLevels.indexOf(this.level) >= Logger.allLevels.indexOf(level);

    if (!shouldHandle) {
      return;
    }

    this.handle(level, message, diagnosticDetails);
  }

  debug(message: LogMessage, details?: LogDetails) {
    this.log("debug", message, details);
  }

  info(message: LogMessage, details?: LogDetails) {
    this.log("info", message, details);
  }

  warn(message: LogMessage, details?: LogDetails) {
    this.log("warn", message, details);
  }

  error(message: LogMessage, details?: LogDetails) {
    this.log("error", message, details);
  }
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  return new Logger(options);
}
