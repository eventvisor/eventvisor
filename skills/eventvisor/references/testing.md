# Testing reference

Full docs: <https://eventvisor.org/docs/testing>

Eventvisor ships an in-process test runner that executes the **same SDK pipeline** applications run — validation, conditions, sampling, transforms, effects, destinations. Specs live under `tests/` (conventionally `tests/events/`, `tests/attributes/`, `tests/destinations/`, `tests/effects/`; file names are conventional, not load-bearing; extension `.spec.yml`).

Run:

```bash
npx eventvisor test
npx eventvisor test --keyPattern="order"          # filter by entity key
npx eventvisor test --assertionPattern="consent"  # filter by assertion description
npx eventvisor test --onlyFailures
npx eventvisor test --verbose                     # per-assertion detail
npx eventvisor test --tag web | --target checkout | --set staging   # test that datafile selection
```

Every spec needs ≥1 assertion; matrices need ≥1 key and ≥1 value per key (lint enforces — empty specs can't fake a pass).

## Event specs

```yaml
event: order_completed
assertions:
  - description: validates, transforms, and routes a completed order
    withAttributes:                 # pre-set attributes
      userId: user-123
      consentAnalytics: true
    withLookups:                    # simulate module lookups, key = "<module>.<path>"
      localstorage.sessionSeen: true
    track:                          # the payload to track
      orderId: order-123
      total: 129.95
      itemCount: 3
    expectedToBeValid: true         # validation outcome
    expectedEvent:                  # the TRANSFORMED payload (what track() returns)
      orderId: order-123
      orderTotal: 129.95            # note: post-rename
      itemCount: 3
    expectedDestinations:           # exact list of destinations reached
      - browserAnalytics
      - orderWarehouse

  # the payload is schema-valid; the pipeline gates it on requiredAttributes,
  # so assert on tracking, not on validity
  - description: not tracked without the required attributes
    track: { orderId: o-1, total: 5, itemCount: 1 }
    expectedToBeValid: true
    expectedToBeTracked: false
    expectedDestinations: []
```

Event assertion fields: `description`, `matrix`, `withAttributes`, `withLookups`, `track`, `actions`, `expectedToBeValid`, `expectedToBeTracked`, `expectedEvent`, `expectedDestinations`, `expectedDestinationsByTag` (map of tag → destination list, for group assertions). `expectedToBeValid` checks only the event schema. `expectedToBeTracked` checks whether the complete pipeline accepted the event.

## Attribute specs

```yaml
attribute: customerTier
assertions:
  - description: accepts a supported tier
    setAttribute: premium           # the value to set (any JSON value)
    expectedToBeValid: true
    expectedToBeSet: true
    expectedAttribute: premium      # stored value AFTER transforms + defaults

  - description: rejects an unknown tier
    setAttribute: platinum
    expectedToBeValid: false
    expectedToBeSet: false
```

For object attributes, `expectedAttribute` asserts the full stored object — including schema `default`s filled in and transform results. `expectedAttribute: null` asserts nothing was stored.

## Destination specs

```yaml
destination: orderWarehouse
assertions:
  - description: builds the warehouse body
    actions:                        # ordered SDK operations
      - type: setAttribute
        name: userId
        value: user-123
      - type: track
        name: order_completed
        value: { orderId: order-123, total: 129.95, itemCount: 3 }
    expectedToBeTransported: true
    expectedBody:                   # the exact body handed to the transport
      order: { id: order-123, total: 129.95 }
      customer: { id: user-123 }
```

Destination assertion fields: `description`, `matrix`, `withAttributes`, `withLookups`, `actions`, `assertAfter` (ms — wait before asserting, for async transports), `expectedToBeTransported`, `expectedBody` (one body), `expectedBodies` (the complete ordered list across multiple tracks).

## Effect specs

```yaml
effect: marketing_pixel
assertions:
  - description: fires once across repeated page views
    actions:
      - type: track
        name: page_view
        value: { url: "https://example.com" }
      - type: track
        name: page_view
        value: { url: "https://example.com/about" }
    expectedState:                  # effect internal state afterwards
      injected: true
    expectedToBeHandled: true
    expectedToBeCalled:             # handler call counts
      - handler: pixel
        times: 1
```

Effect assertion fields: `description`, `matrix`, `withAttributes`, `withLookups`, `actions`, `expectedState`, `expectedToBeHandled`, `expectedToBeCalled` (`[{handler, times?}]`).

## Actions (all spec kinds)

`actions` is an ordered list of `{type: track | setAttribute | removeAttribute, name, value?}` — use it whenever the scenario needs several SDK operations or ordering (set attribute, then track). `withAttributes` is shorthand for initial attributes when order doesn't matter. Event specs can use plain `track:` when a single track is the whole scenario.

Event assertions require `track` or actions. Effect and destination assertions require actions. Every assertion requires at least one expectation. Key and assertion filters fail when they match nothing.

## Matrix assertions

`matrix` expands one assertion into the Cartesian product of its values; `${{ key }}` placeholders substitute anywhere in the assertion, including `description`. A placeholder that is the entire value keeps its original type (numbers stay numbers):

```yaml
event: product_viewed
assertions:
  - description: tracks ${{ productId }} in ${{ country }}
    matrix:
      productId: [sku-shirt, sku-shoes]
      country: [NL, DE]
    withAttributes:
      country: ${{ country }}
    track:
      productId: ${{ productId }}
      price: 49.95
    expectedToBeValid: true
    expectedEvent:
      productId: ${{ productId }}
      price: 49.95
```

## What to test

When authoring or changing an entity, cover:

1. The happy path (valid payload → expected transformed event → expected destinations).
2. The rejection paths, and keep the two kinds apart:
   - **schema rejection** (missing a `required` property, wrong type, value outside an `enum`) → `expectedToBeValid: false`, `expectedDestinations: []`;
   - **pipeline gating** (a missing `requiredAttributes` entry, a failed `conditions` match, sampling) → `expectedToBeValid: true` (**still true**), plus `expectedToBeTracked: false` and `expectedDestinations: []`. The payload was fine; governance stopped it. Asserting `expectedToBeValid: false` here is the single most common mistake in Eventvisor test specs.
3. Any conditional behavior you added (consent gates, per-destination overrides, conditional transforms) — one assertion per branch.
4. For destinations: the exact `expectedBody`, since that's the vendor contract.
5. For effects: idempotency (`times: 1`) when state guards exist.

The Catalog displays all specs with matrix cases expanded and shareable assertion links.
