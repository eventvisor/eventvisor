# Transforms reference

Full docs: <https://eventvisor.org/docs/transforms>

Transforms manipulate data on the fly: event payloads (event level), transport bodies (destination level), attribute values (attribute level), and effect state (effect steps). They run in declaration order; each transform sees the result of the previous one.

## Anatomy

```yaml
transforms:
  - type: set                 # required — one of the types below
    source: eventName         # optional source (source | attribute | payload | state | effect | lookup)
    target: event             # dot-separated path into the value being built
    value: …                  # literal value (when no source)
    conditions: []            # optional per-transform gate (see conditions.md)
```

Lint validates per type: `rename` requires `targetMap`; `remove`, `trim`, and the `to*` conversions require `target`; etc.

## Types

### set — write a value

```yaml
- type: set                   # start over with an empty object (common first step in destinations)
  value: {}

- type: set                   # literal into a (possibly nested) target
  target: meta.version
  value: 2

- type: set                   # copy from a source
  source: eventName
  target: event
```

### remove — drop a property

```yaml
- type: remove
  target: internalNotes       # dot paths fine: payload.user.ssn
```

### rename — move properties

```yaml
- type: rename
  targetMap:
    total: orderTotal         # old: new (dot paths on both sides)

- type: rename                # ordered form when sequence matters
  targetMap:
    - customer.id: customer.externalId
    - legacy.campaign: metadata.campaign
```

### trim — strip whitespace

```yaml
- type: trim
  target: firstName

- payload: lastName           # with an explicit source
  type: trim
  target: lastName
```

### toInteger / toDouble / toBoolean / toString — convert in place

```yaml
- type: toInteger
  target: age
- type: toBoolean
  target: marketingConsent
```

### increment / decrement — numeric adjust

The current `target` value is the numeric input; `value` is the operand (default 1):

```yaml
- type: increment
  target: itemCount           # itemCount += 1

- type: increment
  target: itemCount
  value: 10                   # itemCount += 10
```

### concat — join multiple sources into a string

```yaml
- payload: [firstName, lastName]
  type: concat
  separator: " "
  target: fullName
```

### spread — shallow-merge an object

```yaml
- type: spread                # ...attributes into the current root
  source: attributes

- type: spread                # literal merge into a nested target
  target: metadata
  value:
    processedBy: eventvisor
    pipelineVersion: 1
```

### append — push onto an array

```yaml
- type: append
  target: labels
  value: enriched             # or use a source instead of value
```

## Conditional transforms

Any transform can carry its own `conditions` — it applies only when they match:

```yaml
- lookup: browser.screen.width  # `browser` here is a custom module the app registers
  type: set
  target: screenWidth
  conditions:
    - payload: screenWidth
      operator: notExists     # only fill when the app didn't send it
```

```yaml
- type: set
  target: metadata.priority
  value: high
  conditions:
    and:
      - { payload: channel, operator: equals, value: checkout }
      - { payload: metrics.total, operator: greaterThan, value: 100 }
```

## Level-by-level semantics

- **Event transforms** run after validation — the schema constrains what apps send, not what transforms produce. Their output is what effects, destinations, tests (`expectedEvent`), and the `track()` return value see.
- **Destination transforms** shape the transport body only for that destination; per-destination overrides in the event run first, then the destination's own transforms.
- **Attribute transforms** shape the stored value (`expectedAttribute` in tests asserts post-transform).
- **Effect step transforms** operate on the effect's `state`, never on the event payload. Use the `state:` source for reading state within them.

For a worked, many-step example, see the `transform_showcase` entities in the monorepo's `projects/project-1` (event + destination) — a realistic envelope-building pipeline.
