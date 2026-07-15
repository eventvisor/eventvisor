import { createConsoleModule } from "./index";

describe("createConsoleModule", () => {
  it("routes event levels and errors to the matching console method", async () => {
    const output = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
    const transport = createConsoleModule({ console: output, prefix: "test" }).transport!;
    await transport(
      {
        destinationName: "console",
        eventName: "viewed",
        eventLevel: "warning",
        payload: { id: 1 },
      },
      {} as any,
    );
    const error = new Error("failed");
    await transport(
      { destinationName: "console", eventName: "failed", payload: {}, error },
      {} as any,
    );
    expect(output.warn).toHaveBeenCalledWith("test[viewed]", { id: 1 });
    expect(output.error).toHaveBeenCalledWith("test[failed]", error, {});
  });

  it.each([
    ["error", "error"],
    ["info", "info"],
    ["debug", "debug"],
    ["log", "log"],
    [undefined, "log"],
  ] as const)("routes %s through console.%s", async (level, method) => {
    const output = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
    await createConsoleModule({ console: output }).transport!(
      { destinationName: "console", eventName: "event", eventLevel: level, payload: {} },
      {} as any,
    );
    expect(output[method]).toHaveBeenCalled();
  });
});
