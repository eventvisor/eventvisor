# Schemas reference — reusable Schemas and the JSON Schema subset

Full docs: <https://eventvisor.org/docs/schemas> and <https://eventvisor.org/docs/json-schema>

## Reusable Schemas (`schemas/`)

Shared validation structures, defined once and referenced by key. File path without extension is the key: `schemas/identifier.yml` → `identifier`, `schemas/customer/address.yml` → `customer/address`.

```yaml
# schemas/identifier.yml
description: A non-empty identifier
type: string
minLength: 1
```

Reference with `schema: <key>` at any level of an event or attribute — root, object property, or array items:

```yaml
# events/order_completed.yml
description: Order completed
tags: [backend]
type: object
properties:
  orderId:
    schema: identifier
  customer:
    schema: customer
  relatedIds:
    type: array
    items:
      schema: identifier
required: [orderId, customer]
```

Schemas can reference other Schemas (composition):

```yaml
# schemas/customer.yml
type: object
properties:
  id:
    schema: identifier
  name:
    type: string
required: [id]
```

Properties written next to `schema:` **override** the referenced definition at that location:

```yaml
schema: identifier
description: Order ID     # local description
minLength: 8              # stricter than the shared minLength: 1
```

**Build behavior**: references are resolved transitively and **inlined** into events/attributes at build time — datafiles carry no separate Schema collection, SDKs do no runtime lookup. Targets pull in required Schemas automatically (they're build dependencies, not selectors). Lint rejects missing and circular references. Code generation resolves them before emitting types.

Inspect them like any entity:

```bash
npx eventvisor list schema
npx eventvisor info schema identifier
npx eventvisor find-usage schema identifier
npx eventvisor lint --entityType=schema
```

In Sets projects, each set has its own `schemas/` directory.

## The JSON Schema subset

Eventvisor validates with a subset of JSON Schema. Supported per type:

| Type      | Keywords                                              |
| --------- | ----------------------------------------------------- |
| `string`  | `enum`, `minLength`, `maxLength`, `pattern` (regex)   |
| `number`  | `minimum`, `maximum` (integer or float)               |
| `integer` | `minimum`, `maximum` (whole numbers only)             |
| `boolean` | —                                                     |
| `object`  | `properties`, `required` (nesting to any depth)       |
| `array`   | `items`, `minItems`, `maxItems`, `uniqueItems`        |
| all       | `const`, `default`, `description`, `examples`, `enum` |

Nested object example:

```yaml
type: object
properties:
  user:
    type: object
    properties:
      id: { type: string }
      address:
        type: object
        properties:
          street: { type: string }
          city: { type: string }
        required: [street, city]
required: [user]
```

`default` fills missing values in during validation (handy for consent booleans). `const` pins a value. Anything outside this table (e.g. `oneOf`, `format`, `$ref`) is **not** supported — use reusable Schemas (`schema: key`) instead of `$ref`.

## Design guidance

- Extract a Schema when the same structure appears in ≥2 places (identifiers, money amounts, currency enums, product shapes) — it keeps validation rules consistent across events and attributes and gives the Catalog a single page showing all usage.
- Keep Schemas small and semantic (`identifier`, `money`, `currency`), not page-sized grab bags.
- Tightening a shared Schema tightens **every** referencing event/attribute at once — check `find-usage schema <key>` and apply the loosen-first/tighten-later sequencing from the core rules.
