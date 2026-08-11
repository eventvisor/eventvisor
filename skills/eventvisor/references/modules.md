# Modules reference

Full docs: <https://eventvisor.org/docs/modules>, <https://eventvisor.org/docs/transports>, <https://eventvisor.org/docs/lookups>, <https://eventvisor.org/docs/handlers>, <https://eventvisor.org/docs/persistence>

Modules are how the SDK gains capabilities while the core stays tiny. Definitions in the project reference modules **by name**; applications install and register them at init. Four capability kinds, one module may provide several:

| Capability                                      | Referenced in YAML as                           | Module method                                                    |
| ----------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| **Transport** — deliver events to a destination | `transport: <name>` in destinations             | `transport()`                                                    |
| **Lookup** — read values on demand              | `lookup: <name>.<key>` in conditions/transforms | `lookup()`                                                       |
| **Handler** — execute effect steps              | `handler: <name>` in effect steps               | `handle()`                                                       |
| **Storage** — persist attributes/effect state   | `persist: <name>`                               | `readFromStorage()` / `writeToStorage()` / `removeFromStorage()` |

**The golden rule**: a YAML reference to a module name only works if the running app registered a module with that name. Roll out app-side first, definitions second. Missing transports log "Destination has no transport" diagnostics and deliver nothing.

## Official modules

| Package                                | Creator                               | Provides                                                        | Notes                                                                                             |
| -------------------------------------- | ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@eventvisor/module-console`           | `createConsoleModule()`               | transport `console`                                             | Browser/Node console. Options: `{name, console}` — register twice under different names if needed |
| `@eventvisor/module-http`              | `createHttpModule()`                  | transport `http`                                                | Bounded batches, retry, timed and explicit flush                                                  |
| `@eventvisor/module-beacon`            | `createBeaconModule()`                | transport `beacon`                                              | Browser pagehide delivery with keepalive fallback                                                 |
| `@eventvisor/module-ga4`               | `createGA4Module()`                   | transport `ga4`                                                 | Google Analytics 4                                                                                |
| `@eventvisor/module-gtm`               | `createGTMModule()`                   | transport `gtm`                                                 | Google Tag Manager dataLayer                                                                      |
| `@eventvisor/module-segment-browser`   | `createSegmentBrowserModule({...})`   | transport `segment-browser`                                     | Segment                                                                                           |
| `@eventvisor/module-sentry-browser`    | `createSentryBrowserModule({...})`    | transport `sentry-browser`                                      | Sentry (pairs with `level: error` events)                                                         |
| `@eventvisor/module-datadog-browser`   | `createDatadogBrowserModule({...})`   | transport `datadog-browser`                                     | Datadog                                                                                           |
| `@eventvisor/module-amplitude-browser` | `createAmplitudeBrowserModule({...})` | transport `amplitude-browser`                                   | Amplitude                                                                                         |
| `@eventvisor/module-mixpanel-browser`  | `createMixpanelBrowserModule({...})`  | transport `mixpanel-browser`                                    | Mixpanel                                                                                          |
| `@eventvisor/module-newrelic-browser`  | `createNewrelicBrowserModule()`       | transport `newrelic-browser`                                    | New Relic                                                                                         |
| `@eventvisor/module-localstorage`      | `createLocalStorageModule()`          | storage + lookup `localstorage.<key>`                           | Options: `{name, prefix}`                                                                         |
| `@eventvisor/module-timestamp`         | `createTimestampModule()`             | lookup `timestamp` \| `timestamp.epoch` \| `timestamp.epoch_ms` | ISO 8601 / seconds / ms                                                                           |
| `@eventvisor/module-uuid`              | `createUUIDModule()`                  | lookup `uuid`                                                   | Fresh UUID per lookup                                                                             |
| `@eventvisor/module-pixel`             | `createPixelModule()`                 | handler `pixel`                                                 | Scripts disabled by default; opt in with `allowScripts` and use a CSP nonce                       |

Registration:

```js
import { createEventvisor } from "@eventvisor/sdk";
import { createConsoleModule } from "@eventvisor/module-console";
import { createGA4Module } from "@eventvisor/module-ga4";

const eventvisor = createEventvisor({
  datafile,
  modules: [createConsoleModule(), createGA4Module()],
});
```

Vendor module docs, with setup options like measurement IDs and keys, live under <https://eventvisor.org/docs/modules> (one page per module, e.g. `/docs/modules/ga4`).

## Custom modules

A module is a plain object — `name` plus any of the capability methods:

```ts
import type { EventvisorModule } from "@eventvisor/sdk";

export function createMyBackendModule(): EventvisorModule {
  return {
    name: "myBackend",

    // transport: used by destinations with `transport: myBackend`
    transport: async ({ payload, eventName, eventLevel, error, destinationName, revision }) => {
      // `error` is set when an Error object was tracked (see level: error events)
      await fetch("https://collect.example.com/e", {
        method: "POST",
        body: JSON.stringify(payload),
        keepalive: true,
      });
    },

    // lookup: `lookup: myBackend.<key>` in conditions/transforms
    lookup: async ({ key }) => readSomething(key),

    // handler: `handler: myBackend` in effect steps
    handle: async ({ effectName, effect, step }) => {
      const { params } = step;
      // side-effect here
    },

    // storage: `persist: myBackend`
    readFromStorage: async ({ key }) => …,
    writeToStorage: async ({ key, value }) => …,
    removeFromStorage: async ({ key }) => …,

    // lifecycle (optional)
    setup(api) { api.reportDiagnostic({ level: "info", code: "ready", message: "…", details: {} }); },
    async close() { /* release subscriptions/resources */ },
  };
}
```

Conventions and contracts:

- Export a `create<X>Module(options)` factory so consumers can customize (custom `name`, endpoints, etc.).
- Names must be unique per instance — duplicates are rejected with a diagnostic. Registering the same implementation under two names (two consoles, two backends) is legitimate.
- `addModule()` returns an async, idempotent removal callback; `removeModule(name)` works too. Failed `setup` must clean up its own subscriptions.
- Transports must tolerate concurrent calls and own their batching, retry, persistence, and delivery semantics. They receive the active datafile `revision` and optional validation details.
- Queueing modules implement `flush`; `eventvisor.flush()` runs module flushes in parallel and `close()` flushes first.
- HTTP options use `flushIntervalMs`, `batchSize`, `maxQueueSize`, `maxRetries`, and `retryDelayMs`. Beacon uses `flushIntervalMs`, `batchSize`, and `maxQueueSize`, then flushes on browser lifecycle events.
- Effect handlers that emit events use `api.track()` so the SDK can prevent recursive effect cycles.
- Test destination bodies without real vendors: destination specs assert `expectedBody` against the built body before any transport runs, and `withLookups` simulates lookups ([testing.md](testing.md)).
