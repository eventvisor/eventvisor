import { useEffect, useState } from "react";

import { createInstance } from "@eventvisor/sdk";
import { createConsoleModule } from "@eventvisor/module-console";
import { createLocalStorageModule } from "@eventvisor/module-localstorage";
import { createPixelModule } from "@eventvisor/module-pixel";

// hardcoded datafile (only for testing in this example)
import datafile from "../datafiles/eventvisor-tag-web.json";

import { generateUUID } from "./uuid";

const eventvisor = createInstance({
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

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // we wait for initialization to be complete,
    // because persistence layer is used in marketing-pixel effect
    eventvisor.onReady().then(() => {
      // set deviceId if not set previously already
      if (!eventvisor.isAttributeSet("deviceId")) {
        eventvisor.setAttribute("deviceId", generateUUID());
      }

      setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return <div>Loading...</div>;
  }

  return <HomePage />;
}

export default App;
