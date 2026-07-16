# Sampling reference

Full docs: <https://eventvisor.org/docs/sampling>

Sampling keeps events from a deterministic percentage of users/devices instead of everyone — the main lever for cutting ingestion and bandwidth costs. Distinct from filtering (conditions), which drops events categorically.

## Where to define it

- **Destination level** (recommended): the event still reaches other destinations in full.
- **Event level**: gates the event globally, before any destination sees it.
- **Event → destination override** (`destinations.<name>.sample` in the event file): sampling for one event on one route.

Event-level sampling decides whether the event continues at all; destination-level and override sampling then apply **independently** per route.

## Shapes

```yaml
# simple percentage
sample:
  by: attributes.userId
  percentage: 10              # 10% of unique users (0–100, up to 3 decimals)
```

```yaml
# custom range — start inclusive, end exclusive
sample:
  by: attributes.userId
  range: [0, 50]              # first half of the bucket space
```

```yaml
# composite key
sample:
  by: [attributes.organizationId, attributes.userId]
  percentage: 10
```

```yaml
# first available value — userId if set, else deviceId
sample:
  by:
    or: [attributes.userId, attributes.deviceId]
  percentage: 10
```

```yaml
# conditional rules — first match wins
sample:
  - conditions:
      - { attribute: platform, operator: equals, value: web }
    by: attributes.deviceId
    percentage: 10
  - by: attributes.userId
    percentage: 50
```

`by` also accepts source objects (`by: {attribute: userId}` or `by: {lookup: localstorage.userId}`) — see [sources.md](sources.md).

## Semantics that matter

- **Deterministic**: the same `by` value always lands in the same bucket (stable hash). A user sampled today is sampled tomorrow, on web and on mobile — as long as the key and percentage/range don't change.
- **Consistency across platforms** is why `by` should be a stable identity (`userId`, falling back to `deviceId`), not something ephemeral like a session ID — unless per-session sampling is the explicit goal.
- **Fails closed**: if none of the configured `by` sources resolves to a value, the event is **not** sampled in. Make sure the identity attribute is actually set before events fire, or provide the `or:` fallback.
- **Ranges compose**: `[0, 50]` and `[50, 100]` partition users exactly — the vendor-migration pattern ([recipes.md](recipes.md#migrating-vendors)). Raising `[0, 10]` to `[0, 20]` keeps everyone already included; moving to `[10, 30]` swaps the cohort — avoid.
- Percentages/ranges support three decimal places (`0.125` works).

## Changing sampling safely

| Change                | Effect                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| Raise percentage      | Everyone sampled stays; more join. Safe.                                            |
| Lower percentage      | Some currently-sampled users drop out mid-history. Warn first.                      |
| Change `by` key       | Full re-bucketing — different users sampled. Treat as a breaking analytical change. |
| Shift a range's start | Cohort swap. Same warning as changing `by`.                                         |

## Testing sampled definitions

Sampling makes destination delivery identity-dependent, which complicates specs. Options: assert with attribute values you've confirmed fall in/out of the bucket, or keep `sample` out of entities under heavy test coverage and rely on `simulate` with real IDs:

```bash
npx eventvisor simulate search --value='{"query":"boots"}' --attributes='{"userId":"user-123"}'
```
