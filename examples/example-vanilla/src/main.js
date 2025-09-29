import { setupCounter } from "./counter.js";

document.querySelector("#app").innerHTML = `
  <div>
    <h1>Hello World!</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the counter and see tracked logs in the console.
    </p>
  </div>
`;

setupCounter(document.querySelector("#counter"));
