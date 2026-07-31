import { useEffect, useState } from "react";

import { createEventvisor } from "@eventvisor/sdk";
import { EventvisorProvider, useEventvisor, useEventvisorReady } from "@eventvisor/react";
import { createConsoleModule } from "@eventvisor/module-console";
import { createLocalStorageModule } from "@eventvisor/module-localstorage";
import { createPixelModule } from "@eventvisor/module-pixel";

// hardcoded datafile (only for testing in this example)
import datafile from "../datafiles/eventvisor-web.json";

import { generateUUID } from "./uuid";

const eventvisor = createEventvisor({
  datafile,
  modules: [
    createConsoleModule(),
    createLocalStorageModule(),
    createPixelModule(),

    // ...add more modules here
  ],
});

// for debugging
window.eventvisor = eventvisor;

eventvisor.setAttribute("userId", "user-123");

function HomePage() {
  const [counter, setCounter] = useState(0);
  const { track } = useEventvisor();

  useEffect(() => {
    eventvisor.track("page_view", {
      url: location.href,
    });
  }, []);

  return (
    <>
      <h1>Hello World</h1>

      <div>
        <button
          onClick={() => {
            setCounter(counter + 1);

            eventvisor.track("button_click", { buttonId: "counter" });
          }}
        >
          Counter: {counter}
        </button>

        <button
          onClick={() => {
            eventvisor.track("js_error", new Error("Something went wrong"));
          }}
        >
          Track some error
        </button>
      </div>
    </>
  );
}

function EventvisorApp() {
  const isReady = useEventvisorReady();
  const { instance, setAttribute } = useEventvisor();

  useEffect(() => {
    if (isReady) {
      if (!instance.isAttributeSet("deviceId")) {
        setAttribute("deviceId", generateUUID());
      }
    }
  }, [instance, isReady, setAttribute]);

  if (!isReady) {
    return <div>Loading...</div>;
  }

  return <HomePage />;
}

function App() {
  return (
    <EventvisorProvider instance={eventvisor}>
      <EventvisorApp />
    </EventvisorProvider>
  );
}

export default App;
