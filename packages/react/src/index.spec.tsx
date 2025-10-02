import * as React from "react";
import { render, screen, act } from "@testing-library/react";

import { createInstance } from "@eventvisor/sdk";

import {
  EventvisorProvider,
  useInstance,
  isReady,
  track,
  setAttribute,
  getAttributeValue,
  isAttributeSet,
  removeAttribute,
} from "./index";

async function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("react :: index", function () {
  it("should be a function", function () {
    expect(EventvisorProvider).toBeDefined();
  });
});

describe("react :: index", function () {
  const transportedEvents: Record<string, any>[] = [];

  const eventvisor = createInstance({
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
  });

  it("should run tests", async function () {
    function TestComponent() {
      track("page_view", { url: "https://www.example.com" });
      const ready = isReady();

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
      const loading = screen.getByText("Loading...");

      throw new Error("Loading element should not be found");
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
    } catch (error) {
      throw error;
    }
  });
});
