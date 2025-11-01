import { createNewRelicBrowserModule } from "./index";
import { ModuleDependencies } from "@eventvisor/sdk";

describe("createNewRelicBrowserModule", () => {
  it("should be a function", async () => {
    expect(createNewRelicBrowserModule).toBeDefined();
  });
});
