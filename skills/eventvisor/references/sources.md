# Sources reference

Full docs: <https://eventvisor.org/docs/sources> and <https://eventvisor.org/docs/lookups>

Sources are where conditions, transforms, and sampling keys pull values from. Every condition and most transforms name exactly one source property.

## The source properties

| Property     | Resolves to                                 | Notes                                                                                                         |
| ------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `source:`    | A generic dotted path                       | `eventName`, `attributeName`, `payload`, `payload.url`, `attributes`, `attributes.user.id`, `destinationName` |
| `attribute:` | One attribute's value                       | `attribute: userId`, nested: `attribute: user.country`                                                        |
| `payload:`   | The event/attribute payload being processed | `payload: product.id`                                                                                         |
| `state:`     | The **current** effect's internal state     | Only inside effects                                                                                           |
| `effect:`    | **Another** effect's state, by name         | `effect: cart_activity.itemCount`                                                                             |
| `lookup:`    | A module lookup, on demand                  | `lookup: localstorage.consent`, `lookup: timestamp.epoch_ms`                                                  |

`source:` is the general form; the others are shorthands scoped to one root. These are equivalent:

```yaml
- source: attributes.userId
  operator: equals
  value: user-123

- attribute: userId
  operator: equals
  value: user-123
```

## What's available where

- **Event pipeline** (event conditions/transforms/sampling; destination conditions/transforms/sampling): `payload` (the tracked event's current value), `eventName`, `eventLevel`, `attributes`, and — in destination transforms — `destinationName`.
- **Attribute pipeline** (attribute transforms): `payload` (the value being set), `attributeName`, `attributes`.
- **Effects** (conditions and step transforms): `state` for this effect's own state, `effect: <name>.<path>` for another effect's state, plus the triggering `payload` / `eventName` / `attributeName` and `attributes`.
- **Lookups**: anywhere conditions/transforms run, provided the app installed the module.

## Multiple sources (ordered arrays)

Direct source properties accept a non-empty array when a transform or sampling key needs several values, resolved in declaration order:

```yaml
# concat two payload fields
- payload: [firstName, lastName]
  type: concat
  separator: " "
  target: fullName
```

```yaml
# sample by a composite key
sample:
  by: [attributes.organizationId, attributes.userId]
  percentage: 10
```

## Lookups

A lookup is `<moduleName>.<key path>` — the module's `lookup({ key })` method is called with everything after the first dot. Requires the module installed in the app ([modules.md](modules.md)):

```yaml
# read GDPR consent from browser localStorage.
# localStorage always returns strings, so compare against a string.
conditions:
  - lookup: localstorage.gdprConsent
    operator: equals
    value: "true"

# stamp the current time onto a payload
transforms:
  - lookup: timestamp            # ISO 8601; also timestamp.epoch, timestamp.epoch_ms
    type: set
    target: trackedAt

# generate an ID
transforms:
  - lookup: uuid
    type: set
    target: requestId
```

Official lookup modules: `localstorage.<key>`, `timestamp` / `timestamp.epoch` / `timestamp.epoch_ms`, `uuid`. Custom lookups are a module with a `lookup` method — see [modules.md](modules.md#custom-modules).

In test specs, lookups are simulated with `withLookups: { "localstorage.gdprConsent": true }` — no module needed ([testing.md](testing.md)).
