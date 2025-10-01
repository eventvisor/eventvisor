import { createUUIDModule } from "./index";
import { ModuleDependencies } from "@eventvisor/sdk";

describe("createUUIDModule", () => {
  it("should create a module", async () => {
    const module = createUUIDModule();
    const dependencies = {} as ModuleDependencies; // it's fine because we're not using the dependencies in this module

    expect(module.name).toEqual("uuid");

    const uuid = await module.lookup?.({ key: "" }, dependencies);
    expect(uuid).toBeDefined();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
