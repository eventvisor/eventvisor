import * as React from "react";
import { render, screen, act } from "@testing-library/react";

import { createEventvisor } from "@eventvisor/sdk";

import {
  EventvisorProvider,
  useEventvisorInstance,
  useEventvisorReady,
  useEventvisor,
  useEventvisorAttribute,
  useEventvisorAttributes,
} from "./index.js";

async function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("react :: index", function () {
  it("should be a function", function () {
    expect(EventvisorProvider).toBeDefined();
  });
});

describe("React provider contracts", () => {
  it("throws a useful error outside the provider", () => {
    function Consumer() {
      useEventvisorInstance();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(
      "useEventvisorInstance must be used within EventvisorProvider",
    );
  });

  it("reacts to attribute changes and removals", async () => {
    const instance = createEventvisor({
      logLevel: "error",
      datafile: {
        schemaVersion: "1",
        revision: "1",
        attributes: { userId: { type: "string" } },
        events: {},
        destinations: {},
        effects: {},
      },
    });
    function Consumer() {
      const userId = useEventvisorAttribute("userId");
      const attributes = useEventvisorAttributes();
      return <div>{`${userId || "missing"}:${Object.keys(attributes).length}`}</div>;
    }
    render(
      <EventvisorProvider instance={instance}>
        <Consumer />
      </EventvisorProvider>,
    );
    expect(screen.getByText("missing:0")).toBeTruthy();
    await act(async () => {
      await instance.setAttribute("userId", "123");
    });
    expect(screen.getByText("123:1")).toBeTruthy();
    await act(async () => {
      await instance.removeAttribute("userId");
    });
    expect(screen.getByText("missing:0")).toBeTruthy();
    await instance.close();
  });

  it("returns stable bound methods until the instance changes", () => {
    const first = createEventvisor();
    const second = createEventvisor();
    const values: any[] = [];
    function Consumer() {
      values.push(useEventvisor());
      return null;
    }
    const view = render(
      <EventvisorProvider instance={first}>
        <Consumer />
      </EventvisorProvider>,
    );
    view.rerender(
      <EventvisorProvider instance={first}>
        <Consumer />
      </EventvisorProvider>,
    );
    expect(values[0]).toBe(values[1]);
    view.rerender(
      <EventvisorProvider instance={second}>
        <Consumer />
      </EventvisorProvider>,
    );
    expect(values[2]).not.toBe(values[1]);
  });
});

describe("react :: index", function () {
  const transportedEvents: Record<string, any>[] = [];

  const eventvisor = createEventvisor({
    datafile: {
      schemaVersion: "1",
      revision: "0",
      attributes: {
        userId: {
          type: "string",
        },
        deviceId: {
          type: "string",
        },
      },
      events: {
        page_view: {
          type: "object",
          properties: {
            url: { type: "string" },
          },
          required: ["url"],
        },
        button_click: {
          type: "object",
          properties: {
            buttonId: { type: "string" },
          },
          required: ["buttonId"],
        },
      },
      destinations: {
        test: {
          transport: "test",
        },
      },
      effects: {},
    },
    modules: [
      {
        name: "test",

        transport: async ({ destinationName, eventName, payload }) => {
          transportedEvents.push({ destinationName, eventName, payload });
        },
      },
    ],
    logLevel: "error",
  });

  it("should run tests", async function () {
    function TestComponent() {
      const ready = useEventvisorReady();
      const { track, setAttribute } = useEventvisor();

      // Track page_view when component mounts
      React.useEffect(() => {
        setAttribute("userId", "user-123");
        setAttribute("deviceId", "device-234");

        track("page_view", { url: "https://www.example.com" });
      }, []);

      if (!ready) {
        return <div>Loading...</div>;
      }

      return (
        <div>
          <button id="my-button" onClick={() => track("button_click", { buttonId: "my-button" })}>
            Button
          </button>
        </div>
      );
    }

    render(
      <EventvisorProvider instance={eventvisor}>
        <TestComponent />
      </EventvisorProvider>,
    );

    // expect to be not found
    try {
      screen.getByText("Loading...");

      throw new Error("Loading element should not be found");

      // eslint-disable-next-line
    } catch (error) {
      // pass
    }

    // expect to be found
    try {
      const button = screen.getByText("Button");

      await waitFor(100);

      expect(transportedEvents.length).toEqual(1);

      await act(async () => {
        button.click();
      });

      await waitFor(100);

      expect(transportedEvents.length).toEqual(2);
      expect(transportedEvents[0].eventName).toEqual("page_view");
      expect(transportedEvents[1].eventName).toEqual("button_click");

      expect(eventvisor.getAttributeValue("userId")).toEqual("user-123");
      expect(eventvisor.getAttributeValue("deviceId")).toEqual("device-234");
    } catch (error) {
      throw error;
    }
  });
});
