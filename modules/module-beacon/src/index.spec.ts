import { createBeaconModule } from "./index.js";

function api() {
  return { reportDiagnostic: jest.fn() } as any;
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function event(name = "viewed") {
  return {
    destinationName: "analytics",
    eventName: name,
    revision: "7",
    payload: { id: 1 },
  } as any;
}

describe("createBeaconModule", () => {
  it("batches and flushes with sendBeacon", async () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    const module = createBeaconModule({
      url: "https://events.example",
      batchSize: 2,
      flushIntervalMs: 0,
      sendBeacon,
    });
    const moduleApi = api();
    await module.transport?.(event("one"), moduleApi);
    await module.transport?.(event("two"), moduleApi);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const sent = sendBeacon.mock.calls[0][1];
    expect(sent).toBeInstanceOf(Blob);
    const body = JSON.parse(sent instanceof Blob ? await blobText(sent) : sent);
    expect(body.events.map((item) => item.eventName)).toEqual(["one", "two"]);
  });

  it("snapshots queued payloads before callers can mutate them", async () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    const module = createBeaconModule({
      url: "https://events.example",
      batchSize: 10,
      flushIntervalMs: 0,
      sendBeacon,
    });
    const queued = event();
    await module.transport?.(queued, api());
    (queued.payload as any).id = 2;
    await module.flush?.(api());
    const sent = sendBeacon.mock.calls[0][1];
    const body = JSON.parse(sent instanceof Blob ? await blobText(sent) : sent);
    expect(body.events[0].payload).toEqual({ id: 1 });
  });

  it("falls back to keepalive fetch when sendBeacon rejects a payload", async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const module = createBeaconModule({
      url: "https://events.example",
      batchSize: 1,
      sendBeacon: () => false,
      fetch,
    });
    await module.transport?.(event(), api());
    expect(fetch).toHaveBeenCalledWith(
      "https://events.example",
      expect.objectContaining({ keepalive: true }),
    );
  });

  it("flushes on pagehide and removes its listener on close", async () => {
    const listeners = new Map<string, EventListener>();
    const lifecycleTarget = {
      addEventListener: jest.fn((name, listener) => listeners.set(name, listener as EventListener)),
      removeEventListener: jest.fn(),
    } as any;
    const sendBeacon = jest.fn().mockReturnValue(true);
    const moduleApi = api();
    const module = createBeaconModule({
      url: "https://events.example",
      batchSize: 10,
      flushIntervalMs: 0,
      sendBeacon,
      lifecycleTarget,
    });
    module.setup?.(moduleApi);
    await module.transport?.(event(), moduleApi);
    listeners.get("pagehide")?.({} as Event);
    await Promise.resolve();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    await module.close?.();
    expect(lifecycleTarget.removeEventListener).toHaveBeenCalledWith(
      "pagehide",
      expect.any(Function),
    );
  });

  it("reports queue overflow and terminal delivery failures", async () => {
    const moduleApi = api();
    const module = createBeaconModule({
      url: "https://events.example",
      batchSize: 10,
      maxQueueSize: 1,
      flushIntervalMs: 0,
      sendBeacon: () => false,
      fetch: jest.fn().mockRejectedValue(new Error("offline")),
    });
    await module.transport?.(event("one"), moduleApi);
    await module.transport?.(event("two"), moduleApi);
    expect(moduleApi.reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "beacon_queue_full" }),
    );
    await module.flush?.(moduleApi);
    expect(moduleApi.reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "beacon_delivery_failed" }),
    );
  });

  it("flushes when the document becomes hidden and removes the listener", async () => {
    const listeners = new Map<string, EventListener>();
    const visibilityDocument = {
      visibilityState: "visible",
      addEventListener: jest.fn((name, listener) => listeners.set(name, listener as EventListener)),
      removeEventListener: jest.fn(),
    } as any;
    const sendBeacon = jest.fn().mockReturnValue(true);
    const moduleApi = api();
    const module = createBeaconModule({
      url: "https://events.example",
      batchSize: 10,
      flushIntervalMs: 0,
      sendBeacon,
      visibilityDocument,
    });
    module.setup?.(moduleApi);
    await module.transport?.(event(), moduleApi);
    visibilityDocument.visibilityState = "hidden";
    listeners.get("visibilitychange")?.({} as Event);
    await Promise.resolve();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    await module.close?.();
    expect(visibilityDocument.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
