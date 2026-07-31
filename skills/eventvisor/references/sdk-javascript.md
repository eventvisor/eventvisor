# JavaScript SDK reference

Full docs: <https://eventvisor.org/docs/sdks/javascript>

`@eventvisor/sdk` runs in browsers and Node.js (same package for both). It consumes a datafile and executes the whole pipeline locally — validation, conditions, sampling, transforms, effects, routing. Vendor integrations come from **modules** ([modules.md](modules.md)); the core does nothing vendor-specific.

```bash
npm install @eventvisor/sdk
```

## Creating an instance

```js
import { createEventvisor } from "@eventvisor/sdk";
import { createConsoleModule } from "@eventvisor/module-console";

const datafile = await fetch("https://cdn.example.com/eventvisor-web.json")
  .then((res) => res.json());

const eventvisor = createEventvisor({
  datafile,
  initialAttributes: { deviceId: "device-123" },
  modules: [createConsoleModule()],
  logLevel: "warn",
  onDiagnostic(d) { /* optional structured reports */ },
});
```

`createEventvisor()` is the factory; the `Eventvisor` type is exported for passing instances around. Async SDK operations wait for readiness automatically. Use `await eventvisor.onReady()` when application code must know that persisted attribute and effect state has loaded before doing synchronous reads.

> Migrating pre-v1 code? `createInstance` → `createEventvisor`, `registerModule` → `addModule`, logger handlers → `onDiagnostic`. Full mapping: <https://eventvisor.org/docs/migration/v1>.

## Tracking and attributes — async by contract

```js
const finalPayload = await eventvisor.track("page_view", {
  url: location.href,
  title: document.title,
});
// resolves to the transformed payload, or null when the pipeline dropped it

await eventvisor.setAttribute("userId", "user-123");
await eventvisor.removeAttribute("userId");

eventvisor.getAttributeValue("userId");   // sync reads
eventvisor.getAttributes();
eventvisor.isAttributeSet("userId");
```

`track`, `setAttribute`, `removeAttribute`, `setDatafile`, `removeModule`, `flush`, and `close` are async. Public operations are processed in call order, including calls made before readiness. Await them when the application needs completion or a result. Destination attempts begin in parallel. A `null` from `track` means governance dropped the event, not that an exception occurred.

Invalid attribute values are not set. Invalid event payloads follow `onValidationFailure`: drop by default, deliver with validation metadata, or route to quarantine. Validation failures produce diagnostics. Falsy values (`false`, `0`, `""`) are valid values.

## Updating a datafile

```js
await eventvisor.setDatafile(nextDatafile);        // MERGES into the current one
await eventvisor.setDatafile(nextDatafile, true);  // replaces completely
```

Merge-by-default lets an app load several Target datafiles into one instance. Invalid JSON is reported ("Could not parse datafile") and the active datafile stays. Refreshing preserves in-memory attributes, initializes newly persisted definitions, and drops state for deleted ones.

Refresh strategies (the SDK has no built-in poller — pick one): periodic `setInterval` fetch; refresh on app events (route change, foreground); or push via WebSocket/webhook. Check what's live with `eventvisor.getRevision()` / `eventvisor.getSchemaVersion()`.

## SDK events

```js
const unsub = eventvisor.on("event_tracked", ({ eventName, value }) => { … });
unsub();
```

Available: `ready`, `datafile_set` (`{ replaced }`), `attribute_set`, `attribute_removed`, `event_tracked`, `error`.

Related runtime read: `eventvisor.getStateValue("<effectName>")` returns an effect's current internal state — handy when debugging why an effect did or didn't fire again.

## Diagnostics

Structured reports (level, code, message, details, optional module/error info) from the SDK and modules — validation warnings, missing transports, module failures:

```js
const eventvisor = createEventvisor({ datafile, onDiagnostic: sendToObservability });
const unsub = eventvisor.onDiagnostic((d) => console.log(d.level, d.code, d.message));
```

Error-level diagnostics also fire the `error` SDK event. This is where "Destination has no transport" and validation failures surface in production.

## Modules at runtime

```js
const remove = eventvisor.addModule({
  name: "custom",
  setup(api) { api.reportDiagnostic({ level: "info", code: "ready", message: "…", details: {} }); },
  async close() { /* release resources */ },
});
await remove?.();                          // idempotent removal callback
await eventvisor.removeModule("custom");   // or by name
```

Duplicate module names are rejected (diagnostic). Failed setup cleans up after itself. Module shapes in [modules.md](modules.md).

## Child instances and lifecycle

```js
const child = eventvisor.spawn({ initialAttributes: { application: "checkout" } });
// independent instance sharing the current datafile — per-request contexts on servers,
// per-microfrontend instances in one page
await child.close();
await eventvisor.flush();   // asks queueing modules to attempt buffered work
await eventvisor.close();   // releases modules, diagnostics, listeners
```

Always `close()` what you create — especially in tests and server processes.

## Environment notes

- **Node.js**: identical API — fetch/read the datafile however you like.
- **Old browsers / React Native**: may need a `TextEncoder` polyfill (`fastestsmallesttextencoderdecoder`).
- **Typed usage**: prefer generated bindings for compile-checked event keys and payload types — [code-generation.md](code-generation.md).
