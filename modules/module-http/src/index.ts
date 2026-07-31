import type { EventvisorModule, EventvisorModuleApi, TransportOptions } from "@eventvisor/sdk";

export interface HttpModuleOptions {
  name?: string;
  url: string | ((event: TransportOptions) => string);
  headers?: Record<string, string>;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetch?: typeof globalThis.fetch;
  buildBody?: (events: TransportOptions[]) => unknown;
}

function wait(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration));
}

function serializableEvent(event: TransportOptions) {
  return {
    ...event,
    error: event.error
      ? { name: event.error.name, message: event.error.message, stack: event.error.stack }
      : undefined,
  };
}

function snapshotEvent(event: TransportOptions): TransportOptions {
  return {
    ...event,
    payload: JSON.parse(JSON.stringify(event.payload)),
    validation: event.validation
      ? { valid: false, errors: event.validation.errors.map((entry) => ({ ...entry })) }
      : undefined,
  };
}

export function createHttpModule(options: HttpModuleOptions): EventvisorModule {
  if (!options || !options.url) throw new Error("HTTP module requires a URL.");
  const {
    name = "http",
    headers = {},
    batchSize = 20,
    flushIntervalMs = 1000,
    maxQueueSize = 1000,
    maxRetries = 2,
    retryDelayMs = 250,
    fetch = globalThis.fetch,
    buildBody = (events) => ({ events: events.map(serializableEvent) }),
  } = options;

  if (!fetch) throw new Error("HTTP module requires a fetch implementation.");
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    !Number.isInteger(maxQueueSize) ||
    maxQueueSize < 1
  ) {
    throw new Error("HTTP module batchSize and maxQueueSize must be positive integers.");
  }
  if (
    ![flushIntervalMs, maxRetries, retryDelayMs].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    !Number.isInteger(maxRetries)
  ) {
    throw new Error(
      "HTTP module timing options must be finite and maxRetries must be a nonnegative integer.",
    );
  }

  let queue: TransportOptions[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let flushing: Promise<void> | undefined;

  const resolveUrl = (event: TransportOptions) =>
    typeof options.url === "function" ? options.url(event) : options.url;

  async function send(url: string, events: TransportOptions[]) {
    let attempt = 0;
    while (true) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(buildBody(events)),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return;
      } catch (error) {
        if (attempt >= maxRetries) throw error;
        await wait(retryDelayMs * Math.pow(2, attempt));
        attempt++;
      }
    }
  }

  async function drain(api: EventvisorModuleApi) {
    while (queue.length > 0) {
      const batch = queue.splice(0, batchSize);
      const byUrl = new Map<string, TransportOptions[]>();
      batch.forEach((event) => {
        const url = resolveUrl(event);
        byUrl.set(url, [...(byUrl.get(url) || []), event]);
      });
      await Promise.all(
        [...byUrl].map(async ([url, events]) => {
          try {
            await send(url, events);
          } catch (error) {
            api.reportDiagnostic({
              level: "error",
              code: "http_delivery_failed",
              message: `HTTP delivery failed after ${maxRetries + 1} attempts`,
              details: { url, eventCount: events.length },
              error,
            });
          }
        }),
      );
    }
  }

  async function flush(api: EventvisorModuleApi) {
    if (!flushing) {
      flushing = drain(api).finally(() => {
        flushing = undefined;
      });
    }
    await flushing;
  }

  return {
    name,
    setup(api) {
      if (flushIntervalMs > 0) {
        timer = setInterval(() => void flush(api), flushIntervalMs);
        (timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();
      }
    },
    async transport(event, api) {
      if (queue.length >= maxQueueSize) {
        api.reportDiagnostic({
          level: "error",
          code: "http_queue_full",
          message: "HTTP transport queue is full; event was dropped",
          details: { maxQueueSize, eventName: event.eventName },
        });
        return;
      }
      queue.push(snapshotEvent(event));
      if (queue.length >= batchSize) await flush(api);
    },
    flush,
    close() {
      if (timer) clearInterval(timer);
      timer = undefined;
      queue = [];
    },
  };
}
