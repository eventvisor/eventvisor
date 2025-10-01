import { createTimestampModule } from "./index";
import { ModuleDependencies } from "@eventvisor/sdk";

describe("createTimestampModule", () => {
  it("should create a module", async () => {
    const module = createTimestampModule();
    const dependencies = {} as ModuleDependencies; // it's fine because we're not using the dependencies in this module

    expect(module.name).toEqual("timestamp");

    // epoch
    const epochTimestamp = await module.lookup?.({ key: "epoch" }, dependencies);
    expect(epochTimestamp).toBeDefined();
    expect(epochTimestamp).toBeGreaterThan(0);
    expect(epochTimestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));

    // epoch_ms
    const epochMsTimestamp = await module.lookup?.({ key: "epoch_ms" }, dependencies);
    expect(epochMsTimestamp).toBeDefined();
    expect(epochMsTimestamp).toBeLessThanOrEqual(Date.now());

    // default (iso 8601 with offset)
    const defaultTimestamp = await module.lookup?.({ key: "" }, dependencies);
    expect(defaultTimestamp).toBeDefined();
    expect(defaultTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{2}:\d{2}$/);
  });
});
