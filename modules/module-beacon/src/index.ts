import type { EventvisorModule, EventvisorModuleApi, TransportOptions } from "@eventvisor/sdk";

export interface BeaconModuleOptions {
  name?: string;
  url: string | ((event: TransportOptions) => string);
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  sendBeacon?: (url: string, data: string) => boolean;
  fetch?: typeof globalThis.fetch;
  buildBody?: (events: TransportOptions[]) => unknown;
  lifecycleTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
  visibilityDocument?: Pick<
    Document,
    "visibilityState" | "addEventListener" | "removeEventListener"
  >;
}

function serializableEvent(event: TransportOptions) {
  return {
    ...event,
    error: event.error
      ? { name: event.error.name, message: event.error.message, stack: event.error.stack }
      : undefined,
  };
}

export function createBeaconModule(options: BeaconModuleOptions): EventvisorModule {
  if (!options || !options.url) throw new Error("Beacon module requires a URL.");
  const {
    name = "beacon",
    batchSize = 20,
    flushIntervalMs = 1000,
    maxQueueSize = 1000,
    sendBeacon = globalThis.navigator?.sendBeacon?.bind(globalThis.navigator),
    fetch = globalThis.fetch,
    buildBody = (events) => ({ events: events.map(serializableEvent) }),
    lifecycleTarget = typeof window === "undefined" ? undefined : window,
    visibilityDocument = typeof document === "undefined" ? undefined : document,
  } = options;

  if (!sendBeacon && !fetch) {
    throw new Error("Beacon module requires sendBeacon or fetch.");
  }
  if (batchSize < 1 || maxQueueSize < 1) {
    throw new Error("Beacon module batchSize and maxQueueSize must be positive.");
  }

  let queue: TransportOptions[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let flushing: Promise<void> | undefined;
  let moduleApi: EventvisorModuleApi | undefined;

  const resolveUrl = (event: TransportOptions) =>
    typeof options.url === "function" ? options.url(event) : options.url;

  async function send(url: string, events: TransportOptions[]) {
    const body = JSON.stringify(buildBody(events));
    if (sendBeacon?.(url, body)) return;
    if (!fetch) throw new Error("sendBeacon rejected the payload and no fetch fallback exists");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
              code: "beacon_delivery_failed",
              message: "Beacon delivery failed",
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

  const flushOnPageExit = () => {
    if (moduleApi) void flush(moduleApi);
  };
  const flushWhenHidden = () => {
    if (visibilityDocument?.visibilityState === "hidden") flushOnPageExit();
  };

  return {
    name,
    setup(api) {
      moduleApi = api;
      lifecycleTarget?.addEventListener("pagehide", flushOnPageExit);
      visibilityDocument?.addEventListener("visibilitychange", flushWhenHidden);
      if (flushIntervalMs > 0) {
        timer = setInterval(() => void flush(api), flushIntervalMs);
        (timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();
      }
    },
    async transport(event, api) {
      if (queue.length >= maxQueueSize) {
        api.reportDiagnostic({
          level: "error",
          code: "beacon_queue_full",
          message: "Beacon transport queue is full; event was dropped",
          details: { maxQueueSize, eventName: event.eventName },
        });
        return;
      }
      queue.push(event);
      if (queue.length >= batchSize) await flush(api);
    },
    flush,
    close() {
      if (timer) clearInterval(timer);
      lifecycleTarget?.removeEventListener("pagehide", flushOnPageExit);
      visibilityDocument?.removeEventListener("visibilitychange", flushWhenHidden);
      timer = undefined;
      moduleApi = undefined;
      queue = [];
    },
  };
}
