import { benchmarkEvent } from "./index";

describe("benchmarkEvent", () => {
  it("warms up before measuring and reports distribution statistics", async () => {
    const instance = {
      onReady: jest.fn().mockResolvedValue(undefined),
      track: jest.fn().mockResolvedValue({ accepted: true }),
    } as any;

    const result = await benchmarkEvent(instance, "page", {}, 100);

    expect(instance.onReady).toHaveBeenCalledTimes(1);
    expect(result.warmupIterations).toBe(1);
    expect(instance.track).toHaveBeenCalledTimes(101);
    expect(result.minimum).toBeLessThanOrEqual(result.p50);
    expect(result.p50).toBeLessThanOrEqual(result.p95);
    expect(result.p95).toBeLessThanOrEqual(result.p99);
    expect(result.p99).toBeLessThanOrEqual(result.maximum);
    expect(result.average).toBeGreaterThanOrEqual(result.minimum);
    expect(result.unit).toBe("microseconds");
  });
});
