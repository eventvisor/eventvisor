import { defaultLogHandler, loggerPrefix } from "./logger.js";

describe("defaultLogHandler", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(["error", "fatal"] as const)("writes %s diagnostics to console.error", (level) => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    defaultLogHandler(level, "Delivery failed", { code: "delivery_failed" });
    expect(error).toHaveBeenCalledWith(loggerPrefix, "Delivery failed", {
      code: "delivery_failed",
    });
  });
});
