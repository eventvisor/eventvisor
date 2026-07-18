# Events reference

Full docs: <https://eventvisor.org/docs/events>

Events are the structured data (analytics events or logs) that applications track via the SDK. Each event is one file in `events/`; the file path without extension is the event key (`events/page_view.yml` → `page_view`, `events/auth/signup.yml` → `auth/signup`).

## Complete shape

```yaml
# events/order_completed.yml
description: A customer completed an order   # documentation only
tags: [all, checkout]                        # must be from eventvisor.config.js tags

# --- schema (JSON Schema subset; see schemas.md) ---
type: object                                 # events are always objects
properties:
  orderId:
    schema: identifier                       # reference a reusable Schema
  total:
    schema: money
  itemCount:
    type: integer
    minimum: 1
required: [orderId, total, itemCount]

# --- everything below is optional ---
level: info                                  # fatal | error | warning | log | info | debug
requiredAttributes: [userId, currency]       # these attributes must be set before tracking
skipValidation: false                        # or true, or { conditions: [...] }
conditions: []                               # filter: unmatched -> event dropped entirely
sample:                                      # keep only a bucket of users (see sampling.md)
  by: attributes.userId
  percentage: 10
transforms: []                               # reshape payload once for all destinations
destinations: {}                             # per-destination routing overrides (below)
deprecated: false                            # true -> SDK warns on track, still works
archived: false                              # true -> excluded from datafiles
```

An event can also delegate its whole schema to a reusable Schema:

```yaml
description: A product detail page was viewed
tags: [all, storefront]
schema: product          # root-level reference; see schemas.md
```

## Where each field acts in the pipeline

Order on `track(key, payload)`: required attributes → validation policy → conditions → sampling → event transforms → effects → parallel destination routing → SDK event emission. Validation always sees the original tracked payload. Effects finish before destination routing starts. Destination attempts run in parallel.

- **Validation** checks the original tracked payload — transforms run after, so transformed shapes don't need to satisfy the schema.
- **`requiredAttributes`** is enforced before validation, even when validation is skipped.
- Schema `default` values are filled in during validation (a missing boolean with `default: false` becomes `false`).

## level

Categorizes severity for transports (a Sentry-style transport may treat `error` differently). Defaults to `info`. `fatal | error | warning | log | info | debug`.

## conditions (event-level filtering)

Dropped events never reach any destination — use for "stop tracking X when …":

```yaml
conditions:
  - payload: url
    operator: endsWith
    value: /home
```

See [conditions.md](conditions.md) and [sources.md](sources.md).

## transforms (event-level enrichment)

Applied once, before every destination sees the payload:

```yaml
transforms:
  - type: rename
    targetMap:
      total: orderTotal
  - lookup: timestamp
    type: set
    target: trackedAt
```

See [transforms.md](transforms.md). Remember: `expectedEvent` in tests and the `track()` return value are the **transformed** payload.

## destinations (per-destination overrides)

By default every event reaches every destination in the datafile. Override per destination:

```yaml
destinations:
  browserConsole: false          # never send this event there
  ga4: true                      # explicit default
  warehouse:
    conditions:                  # extra gate for this event -> this destination
      - attribute: consentAnalytics
        operator: equals
        value: true
    sample:                      # extra sampling for this route only
      by: attributes.userId
      percentage: 25
    transforms:                  # reshape for this route only (applied on top of event transforms)
      - type: remove
        target: internalNotes
```

Override gates run **before** the destination's own `conditions`/`sample`/`transforms`. Both must pass.

## skipValidation

```yaml
skipValidation: true                # never validate (avoid; kills the governance value)

skipValidation:                     # conditional bypass (e.g. save cycles in production)
  conditions:
    - attribute: environment
      operator: equals
      value: production
```

`false` and unmatched conditions mean validation runs. Prefer keeping validation on everywhere it's affordable; warnings in pre-production catch wrong shapes early.

Invalid events use `onValidationFailure`: `drop` (default), `deliverWithWarning`, or `{action: quarantine, destination: invalidEvents}`. Warning delivery keeps the original payload and passes errors as transport metadata. Quarantine bypasses normal destinations and effects. Define a new event key for an incompatible event shape.

## Deprecating and archiving

```yaml
deprecated: true   # keeps working; SDKs log a warning on every track -> grace period for teams
archived: true     # removed from generated datafiles; apps tracking it get "unknown event"
```

The safe removal ladder: `deprecated: true` → watch app consoles/diagnostics until warnings stop → `archived: true` (or delete the file). See [recipes.md](recipes.md#deprecating-safely).

## Tracking from applications

```js
await eventvisor.track("order_completed", {
  orderId: "order-123",
  total: 129.95,
  itemCount: 3,
});
```

Resolves to the final transformed payload, or `null` when dropped. Errors can be tracked directly — `eventvisor.track("js_error", new Error("boom"))` — and transports receive the error object separately (see [modules.md](modules.md)).

## Checklist for a new event

1. Key matches project naming convention (check existing files: `snake_case` vs `camelCase`).
2. `tags` chosen so the right apps' datafiles include it.
3. Every `schema:` reference exists in `schemas/`; every `requiredAttributes` entry exists in `attributes/`; every key under `destinations:` exists in `destinations/`.
4. `npx eventvisor lint` passes.
5. Offer a test spec ([testing.md](testing.md), [templates/test-event.spec.yml](../templates/test-event.spec.yml)).
