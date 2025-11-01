import { createSentryBrowserModule } from "./index";

describe("createSentryBrowserModule", () => {
  it("should be a function", async () => {
    expect(createSentryBrowserModule).toBeDefined();
  });
});
