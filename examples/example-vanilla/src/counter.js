import { createInstance } from "@eventvisor/sdk";
import { createConsoleModule } from "@eventvisor/module-console";

// hardcoded datafile (only for testing in this example)
import datafile from "../datafiles/eventvisor-tag-web.json";

const eventvisor = createInstance({
  datafile,
  modules: [createConsoleModule()],
});

// set attributes
eventvisor.setAttribute("userId", "user-123");
eventvisor.setAttribute("deviceId", "device-234");

export function setupCounter(element) {
  let counter = 0;
  const setCounter = (count) => {
    counter = count;
    element.innerHTML = `count is ${counter}`;
  };
  element.addEventListener("click", () => {
    setCounter(counter + 1);

    // track event
    eventvisor.track("button_click", {
      buttonId: "counter",
    });
  });
  setCounter(0);
}
