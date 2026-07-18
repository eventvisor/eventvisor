import { createHttpModule } from "./index.js";

function api() {
  return { reportDiagnostic: jest.fn() } as any;
}

function event(name = "viewed") {
  return {
    destinationName: "warehouse",
    eventName: name,
    revision: "42",
    payload: { id: 1 },
  } as any;
}

describe("createHttpModule", () => {
  it("batches queued events and includes delivery metadata", async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const module = createHttpModule({ url: "https://events.example", batchSize: 2, fetch });
    const moduleApi = api();
    module.setup?.(moduleApi);
    await module.transport?.(event("one"), moduleApi);
    expect(fetch).not.toHaveBeenCalled();
    await module.transport?.(event("two"), moduleApi);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.events).toEqual([
      expect.objectContaining({ eventName: "one", revision: "42" }),
      expect.objectContaining({ eventName: "two", revision: "42" }),
    ]);
    await module.close?.();
  });

  it("retries and reports exhausted delivery failures", async () => {
    const fetch = jest.fn().mockRejectedValue(new Error("offline"));
    const module = createHttpModule({
      url: "https://events.example",
      batchSize: 10,
      maxRetries: 1,
      retryDelayMs: 0,
      fetch,
    });
    const moduleApi = api();
    module.setup?.(moduleApi);
    await module.transport?.(event(), moduleApi);
    await module.flush?.(moduleApi);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(moduleApi.reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "http_delivery_failed" }),
    );
    await module.close?.();
  });

  it("bounds the queue and reports dropped events", async () => {
    const module = createHttpModule({
      url: "https://events.example",
      batchSize: 10,
      maxQueueSize: 1,
      flushIntervalMs: 0,
      fetch: jest.fn().mockResolvedValue({ ok: true }),
    });
    const moduleApi = api();
    await module.transport?.(event("one"), moduleApi);
    await module.transport?.(event("two"), moduleApi);
    expect(moduleApi.reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "http_queue_full" }),
    );
  });

  it("groups one flush by resolved URL and supports custom bodies and headers", async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const module = createHttpModule({
      url: ({ destinationName }) => `https://events.example/${destinationName}`,
      batchSize: 10,
      flushIntervalMs: 0,
      headers: { authorization: "Bearer test" },
      buildBody: (events) => events.map(({ eventName }) => eventName),
      fetch,
    });
    const moduleApi = api();
    await module.transport?.(event("one"), moduleApi);
    await module.transport?.({ ...event("two"), destinationName: "audit" }, moduleApi);
    await module.flush?.(moduleApi);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      "https://events.example/warehouse",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer test" }),
        body: JSON.stringify(["one"]),
      }),
    );
  });

  it("validates required and bounded queue options", () => {
    expect(() => createHttpModule(undefined as any)).toThrow("requires a URL");
    expect(() => createHttpModule({ url: "https://events.example", batchSize: 0 })).toThrow(
      "must be positive",
    );
  });
});
