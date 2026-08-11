# Destinations reference

Full docs: <https://eventvisor.org/docs/destinations> and <https://eventvisor.org/docs/transports>

Destinations are where tracked events end up (console, GA4, Segment, Sentry, a custom backend). Each is one file in `destinations/`. The **transport** — how the event physically gets there — is a module installed in the application ([modules.md](modules.md)); the destination definition only names it.

## Complete shape

```yaml
# destinations/browserAnalytics.yml
description: Consented storefront analytics   # documentation only
tags: [all, storefront]                       # must be from eventvisor.config.js tags

transport: console                            # module name installed in the app (required)

# --- everything below is optional ---
conditions:                                   # filter which events reach this destination
  - attribute: consentAnalytics
    operator: equals
    value: true
sample:                                       # keep a bucket of users for this destination
  by: attributes.userId
  percentage: 10
transforms:                                   # shape the body handed to the transport
  - type: set
    value: {}
  - source: eventName
    type: set
    target: name
  - source: payload
    type: set
    target: properties
  - source: attributes
    type: set
    target: context
archived: false                               # excluded from datafiles
```

## How routing works

Every tracked event that survives the event-level pipeline is offered to **every destination** in the datafile, independently. For each destination the SDK checks, in order:

1. The `transport` module exists in the app — else an error diagnostic ("Destination has no transport") and nothing is delivered. **The #1 silent failure**: definition says `transport: ga4` but the app never installed `@eventvisor/module-ga4`.
2. The event's own per-destination override (`destinations:` in the event file — `false` disables, or its conditions/sample/transforms run first; see [events.md](events.md#destinations-per-destination-overrides)).
3. This destination's `conditions` → `sample` → `transforms`.
4. The resulting body goes to the transport.

So "GA4 only gets page views" can live on either side:

```yaml
# destination side (destinations/ga4.yml) — vendor-centric allowlist
conditions:
  - source: eventName
    operator: in
    value: [page_view, screen_view]
```

```yaml
# event side (events/internal_debug.yml) — event-centric opt-out
destinations:
  ga4: false
```

Prefer the destination side when describing what a vendor should receive; the event side when one event is the exception.

## transforms — building the transport body

The body starts as the event's (already event-transformed) payload. Destination transforms typically rebuild it into the vendor's expected envelope. Available sources here include `payload`, `eventName`, `attributes`, `destinationName`, plus lookups ([sources.md](sources.md)):

```yaml
transforms:
  - type: set
    value: {}              # start fresh with an empty object
  - source: payload
    type: spread           # ...payload
  - source: attributes
    type: spread           # ...attributes
  - source: eventName
    type: set
    target: event          # body.event = eventName
```

Equivalent JavaScript: `body = { ...payload, ...attributes }; body.event = eventName;`

Dot-separated targets create nested structure (`target: order.id`). Full transform catalog in [transforms.md](transforms.md).

## sample

Destination-level sampling is the recommended place to cut ingestion costs — the event still reaches other destinations. See [sampling.md](sampling.md).

## Archiving

`archived: true` removes the destination from datafiles — delivery stops on the apps' next datafile refresh, no app deploy needed. Check `find-usage destination <name>` (events may carry overrides naming it) and clean those up too.

## Adding a destination end-to-end

1. Create `destinations/<name>.yml` with the transport module's name ([modules.md](modules.md) lists official transport names: `http` and `beacon` for your own endpoints, `console` for development, `ga4`, `gtm`, `segment-browser`, `sentry-browser`, `datadog-browser`, `amplitude-browser`, `mixpanel-browser`, `newrelic-browser` for vendors, or a custom module name). For a real backend, `http` (bounded batching and retries) or `beacon` (delivery on page hide) is almost always the right answer over a hand-written transport.
2. Tell the user the application change: `npm install @eventvisor/module-<x>` and add `create<X>Module(...)` to `createEventvisor({ modules: [...] })`. **App first, definition second** — otherwise events route to a transport that isn't there.
3. `npx eventvisor lint`, then offer a destination test spec asserting the exact body ([templates/test-destination.spec.yml](../templates/test-destination.spec.yml)).
