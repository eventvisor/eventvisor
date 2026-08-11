# Eventvisor example project

A small, complete Eventvisor project demonstrating every entity kind working together:

- **Attributes** — `userId` (via a reusable Schema), `deviceId`, `country` (constrained), `consentAnalytics` (boolean with a default);
- **Schemas** — a shared `identifier`;
- **Events** — `page_view` (plain schema) and `signup_completed` (enum, `requiredAttributes`, an enriching transform);
- **Destinations** — `browserConsole` with a consent condition and envelope-building transforms;
- **Effects** — `welcome_banner`, stateful and idempotent, using the `pixel` handler;
- **Targets** — a dependency-aware `web` datafile;
- **Tests** — event, attribute, destination, and effect specs, including a matrix assertion.

## Try it

```bash
npm install
npx eventvisor lint
npx eventvisor test
npx eventvisor build
npx eventvisor catalog
```

## Use as a starting point

Copy this directory, `npm install`, and replace the entities with your own — or scaffold an official reference instead:

```bash
npx @eventvisor/cli init --project=demo
```

The application side needs `@eventvisor/sdk` plus `@eventvisor/module-console` (for the `console` transport) and `@eventvisor/module-pixel` (for the `pixel` handler):

```js
import { createEventvisor } from "@eventvisor/sdk";
import { createConsoleModule } from "@eventvisor/module-console";
import { createPixelModule } from "@eventvisor/module-pixel";

const datafile = await fetch("https://cdn.example.com/eventvisor-web.json")
  .then((res) => res.json());

const eventvisor = createEventvisor({
  datafile,
  modules: [createConsoleModule(), createPixelModule()],
});

await eventvisor.setAttribute("consentAnalytics", true);
await eventvisor.track("page_view", { url: location.href, title: document.title });
```
