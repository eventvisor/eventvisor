import { DatafileContent } from "@eventvisor/types";

import { createInstance } from "./instance";
import { Module } from "./modulesManager";
import { emptyDatafile } from "./datafileReader";

function waitFor(durationInMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationInMs));
}

describe("sdk: instance", function () {
  it("should be a function", function () {
    expect(createInstance).toBeDefined();
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

    const testModule: Module = {
      name: "test",

      transport: async ({ destinationName, eventName, payload }) => {
        capturedEvents.push({ destinationName, eventName, payload });
      },

      handle: async ({ effectName, step }) => {
        capturedHandles.push({ effectName, step });
      },
    };

    const eventvisor = createInstance({
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
});
