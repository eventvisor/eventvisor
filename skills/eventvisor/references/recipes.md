# Recipes — higher-level patterns

Full docs: <https://eventvisor.org/docs/use-cases> (one page per pattern)

Adapt the matching section; each links back to the granular references for shape details.

## Governance / single source of truth

The umbrella use case: all events, attributes, schemas, destinations, and effects in one reviewed Git repo. Product, engineering, data, marketing, and compliance collaborate via PRs; SDKs enforce the schemas at runtime. When a user asks "how do we stop teams from tracking whatever they want" — this is the answer: define entities centrally ([events.md](events.md)), turn on validation everywhere, wire CODEOWNERS (below), and deploy the Catalog as the shared tracking plan ([querying.md](querying.md#visual-review-with-the-catalog)).

## Conditional routing

Different events to different vendors, from one `track()` call:

```yaml
# destinations/ga4.yml — GA4 gets page views only
transport: ga4
conditions:
  - source: eventName
    operator: equals
    value: page_view
```

```yaml
# destinations/gtm.yml — GTM gets button clicks only
transport: gtm
conditions:
  - source: eventName
    operator: equals
    value: button_click
```

App installs both modules; routing changes never touch app code again. Event-side `destinations:` overrides handle per-event exceptions ([events.md](events.md#destinations-per-destination-overrides)).

## Migrating vendors

Old and new destinations side by side; move traffic incrementally without app deploys:

**By filtering** (event-by-event cutover):

```yaml
# destinations/oldVendor.yml
conditions:
  - source: eventName
    operator: notIn
    value: [pageView, buttonClick]     # migrated events leave the old vendor
# destinations/newVendor.yml
conditions:
  - source: eventName
    operator: in
    value: [pageView, buttonClick]
```

**By sampling** (user-percentage cutover, no double-ingestion):

```yaml
# old vendor
sample: { by: attributes.userId, range: [50, 100] }
# new vendor
sample: { by: attributes.userId, range: [0, 50] }
```

Widen `[0, 50]` → `[0, 100]` as confidence grows (start-anchored ranges only grow the cohort). Double-shipping for a comparison window is fine too — just leave both unsampled. Cleanup: archive the old destination; apps remove its module at leisure. **Order matters**: apps must install the new vendor's module before its destination definition lands ([modules.md](modules.md)).

## Saving ingestion costs

Filtering removes categories; sampling keeps a representative percentage:

```yaml
# destination-level (recommended): only this vendor is reduced
sample:
  by: attributes.userId       # stable identity => consistent cross-device sampling
  percentage: 10
```

High-volume, low-value events (scroll, hover, heartbeats) are the usual targets. Quantify when you're done ("~90% fewer `scroll` events to Datadog"). See [sampling.md](sampling.md) for safety rules.

## Validation rollout

SDKs warn on unknown events and wrong-shaped payloads out of the box. To roll governance into a brownfield org: define events loosely (few `required`s) → watch warnings in app consoles/diagnostics → tighten schemas as apps comply (loosen-first/tighten-later, core rule 1). `skipValidation: {conditions: [environment equals production]}` keeps validation cost out of production while pre-production catches shape drift ([events.md](events.md#skipvalidation)).

## Deprecating safely

```yaml
deprecated: true    # phase 1: warnings in every tracking app, data still flows
```

Wait out the grace period, confirm warnings stopped, then `archived: true` or delete (phase 2). Applies to events and attributes alike. Never jump straight to deletion — apps tracking a deleted event get validation warnings and silent data loss.

## Filtering out an event centrally

Can't get every team to remove a dead `track()` call quickly? Cut it at the datafile:

```yaml
# in the event definition — stop routing anywhere
destinations:
  theOnlyDestination: false
```

or destination-side: `conditions: [{source: eventName, operator: notIn, value: [button_click]}]`. Effective on the next datafile refresh, no app deploys.

## Data enrichment

Add/clean data on the fly without redeploying apps: event transforms for all destinations, destination transforms per vendor, lookups for runtime values:

```yaml
transforms:
  - lookup: timestamp
    type: set
    target: trackedAt
  - lookup: localstorage.abTestGroup
    type: set
    target: experimentGroup
  - type: remove
    target: email        # strip PII before vendors see it
```

See [transforms.md](transforms.md), [sources.md](sources.md).

## Marketing pixels with oversight

The GTM problem: marketing injects scripts with zero engineering review. The Eventvisor answer: pixels are `effects` in the reviewed repo, executed by `@eventvisor/module-pixel`:

```yaml
# effects/meta_pixel.yml
description: Meta pixel, once per browser, after consent
tags: [web]
on:
  event_tracked: [page_view]
state: { injected: false }
conditions:
  - { state: injected, operator: equals, value: false }
  - { lookup: localstorage.gdprConsent, operator: equals, value: true }
steps:
  - handler: pixel
    params:
      snippet: |
        <script> /* vendor snippet; {{ payload.url }} available */ </script>
      selector: body
  - transforms:
      - { type: set, target: injected, value: true }
persist: localstorage    # "once" survives reloads
```

App needs `@eventvisor/module-pixel` + `@eventvisor/module-localstorage`. Test idempotency with `expectedToBeCalled: [{handler: pixel, times: 1}]` ([effects.md](effects.md)).

## Tracking errors

Errors are just events with `level: error`:

```yaml
# events/js_error.yml
description: JavaScript error
tags: [web]
level: error
type: object
properties:
  name: { type: string }
  message: { type: string }
  stack: { type: string }
required: [message]
```

```js
eventvisor.track("js_error", new Error("Something went wrong"));
```

Transports receive the original `error` object as a separate argument — a Sentry-style transport forwards it with full fidelity while analytics vendors get the serialized payload. Prefix per platform (`js_error`, `swift_error`) since error shapes differ. Errors then get routing/filtering/sampling like everything else.

## Microfrontends

One project, one Target per microfrontend (`products`, `checkout`, `account`), with tags as reusable selection metadata. Each microfrontend loads `eventvisor-<target>.json` with its own SDK instance. `spawn()` shares one datafile across per-area instances when a shell app owns fetching. See [tags-targets.md](tags-targets.md).

## Environments

Ordinary `environment` attribute when one datafile should serve all lanes; **Sets** when lanes need independent definitions/tests/datafiles. Full trade-off in [sets.md](sets.md).

## Ownership

Tags scope datafiles; **CODEOWNERS scopes authority**:

```
# .github/CODEOWNERS
events/payment_*.yml   @payments-team
destinations/*.yml     @data-platform
attributes/*.yml       @data-platform @web-platform
```

Plus branch protection ("Require review from Code Owners"). Now a payments event can't change without the payments team approving — the review workflow _is_ the governance. Audit trail comes free with Git (`git log --follow`, Catalog per-entity history).
