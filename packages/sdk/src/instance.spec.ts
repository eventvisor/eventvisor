import { DatafileContent } from "@eventvisor/types";

import { createEventvisor } from "./instance";
import { EventvisorModule } from "./modulesManager";
import { emptyDatafile } from "./datafile";

function waitFor(durationInMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

describe("sdk: instance", function () {
  it("should be a function", function () {
    expect(createEventvisor).toBeDefined();
  });

  it("should be initialized", async function () {
    const datafile: DatafileContent = {
      ...emptyDatafile,
      attributes: {
        userId: {
          type: "string",
        },
        deviceId: {
          type: "string",
        },
        browser: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
          },
          required: ["name", "version"],
        },
      },
      events: {
        pageView: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
      },
      effects: {
        someEffectName: {
          on: {
            event_tracked: ["pageView"],
            attribute_set: ["userId"],
          },
          state: {
            handled: false,
          },
          conditions: [
            {
              state: "handled",
              operator: "equals",
              value: false,
            },
          ],
          steps: [
            {
              handler: "test",
            },
            {
              transforms: [
                {
                  type: "set",
                  target: "handled",
                  value: true,
                },
              ],
            },
          ],
        },
      },
      destinations: {
        test: {
          transport: "test",
          transforms: [
            {
              type: "set",
              value: {},
            },
            {
              type: "set",
              source: "attributes",
              target: "attributes",
            },
            {
              type: "set",
              source: "payload",
              target: "payload",
            },
            {
              type: "set",
              source: "eventName",
              target: "eventName",
            },
          ],
        },
      },
    };

    const capturedEvents: Record<string, any>[] = [];
    const capturedHandles: Record<string, any>[] = [];

    const testModule: EventvisorModule = {
      name: "test",

      transport: async ({ destinationName, eventName, payload }) => {
        capturedEvents.push({ destinationName, eventName, payload });
      },

      handle: async ({ effectName, step }) => {
        capturedHandles.push({ effectName, step });
      },
    };

    const eventvisor = createEventvisor({
      datafile,
      modules: [testModule],
      logLevel: "warn",
    });

    await eventvisor.onReady();

    expect(eventvisor.isReady()).toBe(true);

    /**
     * Attributes
     */
    expect(eventvisor.getAttributeValue("userId")).toBeNull();
    expect(eventvisor.isAttributeSet("userId")).toBe(false);

    eventvisor.setAttribute("userId", "user-123");
    eventvisor.setAttribute("deviceId", "device-234");

    await waitFor(0);

    expect(eventvisor.getAttributeValue("userId")).toBe("user-123");
    expect(eventvisor.getAttributeValue("deviceId")).toBe("device-234");
    expect(eventvisor.isAttributeSet("userId")).toBe(true);
    expect(eventvisor.isAttributeSet("deviceId")).toBe(true);

    eventvisor.removeAttribute("deviceId");

    await waitFor(0);

    expect(eventvisor.getAttributeValue("deviceId")).toBeNull();

    eventvisor.setAttribute("browser", { name: "Chrome", version: "100" });
    eventvisor.setAttribute("deviceId", "device-234");

    /**
     * Events
     */
    eventvisor.track("pageView", { url: "https://www.example.com" });

    await waitFor(0);

    expect(capturedEvents[0].payload).toEqual({
      eventName: "pageView",
      payload: { url: "https://www.example.com" },
      attributes: {
        userId: "user-123",
        deviceId: "device-234",
        browser: { name: "Chrome", version: "100" },
      },
    });

    /**
     * Effects
     */
    expect(capturedHandles.length).toEqual(1);
    expect(capturedHandles[0].effectName).toBe("someEffectName");

    eventvisor.track("pageView", { url: "https://www.example.com" });

    await waitFor(0);

    // should not increase
    expect(capturedHandles.length).toEqual(1);
  });

  describe("skipValidation", function () {
    const baseDatafile: DatafileContent = {
      ...emptyDatafile,
      events: {
        strictEvent: {
          type: "object",
          properties: {
            url: { type: "string" },
            count: { type: "number" },
          },
          required: ["url", "count"],
        },
      },
      destinations: {
        test: {
          transport: "test",
          transforms: [
            { type: "set", value: {} },
            { type: "set", source: "payload", target: "payload" },
            { type: "set", source: "eventName", target: "eventName" },
          ],
        },
      },
    };

    async function createEventvisorWithDatafile(datafile: DatafileContent) {
      const captured: any[] = [];
      const eventvisor = createEventvisor({
        datafile,
        modules: [
          {
            name: "test",
            transport: async ({ destinationName, eventName, payload }) => {
              captured.push({ destinationName, eventName, payload });
            },
          },
        ],
        logLevel: "warn",
      });
      await eventvisor.onReady();
      return { eventvisor, captured };
    }

    it("runs validation when skipValidation is undefined", async function () {
      const { eventvisor, captured } = await createEventvisorWithDatafile(baseDatafile);

      const validResult = await eventvisor.track("strictEvent", {
        url: "https://example.com",
        count: 1,
      });
      expect(validResult).not.toBeNull();
      expect(captured.length).toBe(1);
      expect(captured[0].payload.payload).toEqual({
        url: "https://example.com",
        count: 1,
      });

      const invalidResult = await eventvisor.track("strictEvent", {
        url: "https://example.com",
        // missing required "count"
      } as any);
      expect(invalidResult).toBeNull();
      expect(captured.length).toBe(1); // still 1, not 2
    });

    it("skips validation when skipValidation is true", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: true,
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      const invalidResult = await eventvisor.track("strictEvent", {
        url: "https://example.com",
      } as any);
      expect(invalidResult).not.toBeNull();
      expect(captured.length).toBe(1);
    });

    it("runs validation when skipValidation is false", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: false,
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      const result = await eventvisor.track("strictEvent", {
        url: "https://example.com",
        // missing required "count" - would fail validation
      } as any);
      expect(result).toBeNull();
      expect(captured.length).toBe(0);
    });

    it("runs validation when skipValidation.conditions do not match", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: {
              conditions: [
                {
                  source: "eventName",
                  operator: "equals",
                  value: "otherEvent",
                },
              ],
            },
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      // eventName is "strictEvent", condition expects "otherEvent" -> validation remains enabled
      const result = await eventvisor.track("strictEvent", {
        url: "https://example.com",
      } as any);
      expect(result).toBeNull();
      expect(captured.length).toBe(0);
    });

    it("skips validation when skipValidation.conditions match", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: {
              conditions: [
                {
                  source: "eventName",
                  operator: "equals",
                  value: "strictEvent",
                },
              ],
            },
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      // condition matches -> validation is skipped
      const invalidResult = await eventvisor.track("strictEvent", {
        url: "https://example.com",
      } as any);
      expect(invalidResult).not.toBeNull();
      expect(captured.length).toBe(1);

      // valid payload still passes
      const validResult = await eventvisor.track("strictEvent", {
        url: "https://example.com",
        count: 2,
      });
      expect(validResult).not.toBeNull();
      expect(captured.length).toBe(2);
      expect(captured[1].payload.payload).toEqual({
        url: "https://example.com",
        count: 2,
      });
    });

    it("skipValidation.conditions with payload source skips only when it matches", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: {
              conditions: [
                {
                  payload: "skip",
                  operator: "equals",
                  value: true,
                },
              ],
            },
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      // payload.skip !== true -> conditions not matched -> validation fails
      const result = await eventvisor.track("strictEvent", {
        url: "https://example.com",
      } as any);
      expect(result).toBeNull();
      expect(captured.length).toBe(0);

      // payload.skip === true -> conditions matched -> validation is skipped
      const result2 = await eventvisor.track("strictEvent", {
        url: "https://example.com",
        skip: true,
      } as any);
      expect(result2).not.toBeNull();
      expect(captured.length).toBe(1);
    });

    it("skipValidation.conditions with multiple conditions requires all to match before skipping", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: {
              conditions: [
                { source: "eventName", operator: "equals", value: "strictEvent" },
                { payload: "env", operator: "equals", value: "prod" },
              ],
            },
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      // only eventName matches, so validation remains enabled
      const result = await eventvisor.track("strictEvent", {
        url: "https://example.com",
        env: "dev",
      } as any);
      expect(result).toBeNull();
      expect(captured.length).toBe(0);

      // both match, so validation is skipped
      const result2 = await eventvisor.track("strictEvent", {
        url: "https://example.com",
        env: "prod",
      } as any);
      expect(result2).not.toBeNull();
      expect(captured.length).toBe(1);
    });

    it("skipValidation as empty object does not skip validation", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: {},
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      const invalidResult = await eventvisor.track("strictEvent", {
        url: "https://example.com",
      } as any);
      expect(invalidResult).toBeNull();
      expect(captured.length).toBe(0);
    });

    it("skipValidation.conditions with single condition as object (not array)", async function () {
      const datafile: DatafileContent = {
        ...baseDatafile,
        events: {
          strictEvent: {
            ...baseDatafile.events!.strictEvent!,
            skipValidation: {
              conditions: {
                source: "eventName",
                operator: "equals",
                value: "otherEvent",
              },
            },
          } as any,
        },
      };
      const { eventvisor, captured } = await createEventvisorWithDatafile(datafile);

      const result = await eventvisor.track("strictEvent", {
        url: "https://example.com",
      } as any);
      expect(result).toBeNull();
      expect(captured.length).toBe(0);
    });
  });

  describe("strict object schemas", function () {
    it("rejects tracked event payloads with unknown object properties", async function () {
      const captured: any[] = [];
      const eventvisor = createEventvisor({
        datafile: {
          ...emptyDatafile,
          events: {
            strictEvent: {
              type: "object",
              properties: {
                screen: {
                  type: "object",
                  properties: {
                    width: { type: "number" },
                  },
                  required: ["width"],
                },
              },
              required: ["screen"],
            },
          },
          destinations: {
            test: {
              transport: "test",
              transforms: [
                { type: "set", value: {} },
                { type: "set", source: "payload", target: "payload" },
              ],
            },
          },
        },
        modules: [
          {
            name: "test",
            transport: async ({ payload }) => {
              captured.push(payload);
            },
          },
        ],
        logLevel: "warn",
      });

      await eventvisor.onReady();

      const result = await eventvisor.track("strictEvent", {
        screen: {
          width: 100,
          height: 200,
        },
      } as any);

      expect(result).toBeNull();
      expect(captured).toEqual([]);
    });

    it("rejects attribute values with unknown object properties", async function () {
      const eventvisor = createEventvisor({
        datafile: {
          ...emptyDatafile,
          attributes: {
            browser: {
              type: "object",
              properties: {
                name: { type: "string" },
                version: { type: "string" },
              },
              required: ["name", "version"],
            },
          },
        },
        logLevel: "warn",
      });

      await eventvisor.onReady();

      const result = await eventvisor.setAttribute("browser", {
        name: "Chrome",
        version: "123",
        major: 123,
      } as any);

      expect(result).toBeNull();
      expect(eventvisor.getAttributeValue("browser")).toBeNull();
    });
  });
});
