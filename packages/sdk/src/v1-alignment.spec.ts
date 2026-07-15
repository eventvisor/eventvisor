import { createEventvisor } from "./index";
import type { DatafileContent } from "@eventvisor/types";

function datafile(overrides: Partial<DatafileContent> = {}): DatafileContent {
  return {
    schemaVersion: "1",
    revision: "1",
    attributes: {},
    events: {},
    destinations: {},
    effects: {},
    ...overrides,
  };
}

describe("Eventvisor public lifecycle", () => {
  it("reports invalid datafiles without throwing and preserves the parse message", async () => {
    const diagnostics: any[] = [];
    const instance = createEventvisor({
      datafile: "{",
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      logLevel: "fatal",
    });
    await instance.onReady();
    expect(diagnostics[0]).toMatchObject({ code: "invalid_datafile", level: "error" });
    expect(diagnostics[0].message).toContain("Could not parse datafile");
    await instance.close();
  });

  it("merges datafiles by default and replaces only when requested", async () => {
    const instance = createEventvisor({
      datafile: datafile({ events: { first: { type: "object" } } }),
    });
    await instance.setDatafile(datafile({ revision: "2", events: { second: { type: "object" } } }));
    expect(await instance.track("first", {})).toEqual({});
    expect(await instance.track("second", {})).toEqual({});
    await instance.setDatafile(
      datafile({ revision: "3", events: { third: { type: "object" } } }),
      true,
    );
    expect(await instance.track("first", {})).toBeNull();
    expect(await instance.track("third", {})).toEqual({});
    await instance.close();
  });

  it("runs module setup, rejects duplicates, removes modules and closes once", async () => {
    const diagnostics: any[] = [];
    const setup = jest.fn();
    const close = jest.fn();
    const instance = createEventvisor({
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      modules: [{ name: "one", setup, close }],
    });
    instance.addModule({ name: "one" });
    expect(setup).toHaveBeenCalledTimes(1);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "duplicate_module", moduleName: "one" }),
    );
    await instance.removeModule("one");
    await instance.close();
    await instance.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("returns an idempotent module removal function", async () => {
    const close = jest.fn();
    const instance = createEventvisor();
    const remove = instance.addModule({ name: "temporary", close });

    expect(remove).toBeDefined();
    await remove?.();
    await remove?.();
    await instance.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("cleans up a module when setup fails", async () => {
    const subscribed = jest.fn();
    const close = jest.fn();
    let api: any;
    const instance = createEventvisor({
      onDiagnostic: subscribed,
      logLevel: "fatal",
    });

    instance.addModule({
      name: "broken",
      setup(value) {
        api = value;
        api.onDiagnostic(subscribed);
        throw new Error("setup failed");
      },
      close,
    });
    await Promise.resolve();
    subscribed.mockClear();

    api.reportDiagnostic({ level: "info", code: "after", message: "after", details: {} });
    expect(subscribed).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    await instance.close();
  });

  it("cleans module diagnostic subscriptions when removing a module", async () => {
    const seen = jest.fn();
    let api: any;
    const instance = createEventvisor({
      modules: [
        {
          name: "reporter",
          setup: (value) => {
            api = value;
            api.onDiagnostic(seen);
          },
        },
      ],
    });
    await instance.onReady();
    seen.mockClear();
    api.reportDiagnostic({ level: "info", code: "before", message: "before", details: {} });
    expect(seen).toHaveBeenCalledTimes(1);
    await instance.removeModule("reporter");
    instance.onDiagnostic(() => undefined);
    // Reporting through the retained API reaches the instance, but not the removed module subscription.
    api.reportDiagnostic({ level: "info", code: "after", message: "after", details: {} });
    expect(seen).toHaveBeenCalledTimes(1);
    await instance.close();
  });

  it("requires configured event attributes and applies destination overrides independently", async () => {
    const transported = jest.fn();
    const instance = createEventvisor({
      datafile: datafile({
        attributes: { userId: { type: "string" } },
        events: {
          purchase: {
            type: "object",
            requiredAttributes: ["userId"],
            destinations: {
              analytics: { transforms: [{ type: "set", target: "source", value: "override" }] },
            },
          },
        },
        destinations: { analytics: { transport: "transport" } },
      }),
      modules: [{ name: "transport", transport: transported }],
      logLevel: "fatal",
    });
    expect(await instance.track("purchase", {})).toBeNull();
    await instance.setAttribute("userId", "123");
    expect(await instance.track("purchase", {})).toEqual({});
    expect(transported).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { source: "override" } }),
      expect.anything(),
    );
    await instance.close();
  });

  it("emits tracked and datafile events including replacement state", async () => {
    const instance = createEventvisor({
      datafile: datafile({ events: { viewed: { type: "object" } } }),
    });
    const tracked = jest.fn();
    const set = jest.fn();
    instance.on("event_tracked", tracked);
    instance.on("datafile_set", set);
    await instance.track("viewed", {});
    await instance.setDatafile(datafile(), true);
    expect(tracked).toHaveBeenCalledWith({ eventName: "viewed", value: {} });
    expect(set).toHaveBeenCalledWith({ replaced: true });
    await instance.close();
  });
});
