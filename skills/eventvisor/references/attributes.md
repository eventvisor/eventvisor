# Attributes reference

Full docs: <https://eventvisor.org/docs/attributes>

Attributes are contextual data about the user/device/environment that changes rarely (`userId`, `deviceId`, `country`, `consentAnalytics`, …). Applications set them with `setAttribute`; definitions live one per file in `attributes/` (file path = attribute name, nested dirs namespace with `/`).

Attributes are used everywhere: in conditions (`attribute: country`), transforms (spread into destination bodies), sampling identities (`by: attributes.userId`), event `requiredAttributes`, and effect triggers.

## Complete shape

```yaml
# attributes/customerTier.yml
description: Customer loyalty tier           # documentation only
tags: [all, storefront]                      # must be from eventvisor.config.js tags

# --- schema (JSON Schema subset; see schemas.md) ---
type: string                                 # string | number | integer | boolean | object | array
enum: [guest, standard, premium]
default: guest                               # filled in when the set value omits it

# --- everything below is optional ---
transforms: []                               # reshape the value after validation
persist: localstorage                        # survive restarts via a storage module
deprecated: false                            # SDK warns on set, still works
archived: false                              # excluded from datafiles
```

Unlike events, attributes can be **any** type, and can delegate to a reusable Schema:

```yaml
description: User ID
tags: [all]
schema: identifier
```

Object attributes support nested `properties`/`required`; array attributes support `items`. Full subset in [schemas.md](schemas.md).

## Pipeline on setAttribute

`setAttribute(name, value)` → validate against schema (invalid → **not set**, warning logged) → `transforms` applied → stored → effects with `on: attribute_set` fire → persisted if `persist` matches.

- Defaults are applied during validation: setting `{id: "1", country: "NL"}` on an object schema with `isHuman: {type: boolean, default: true}` stores `isHuman: true` too.
- Falsy values (`false`, `0`, `""`) are valid values — "set" is not "truthy".

## transforms

Same transform system as events ([transforms.md](transforms.md)), applied to the attribute's own value:

```yaml
transforms:
  - payload: [firstName, lastName]     # payload = the value being set
    type: concat
    separator: " "
    target: fullName
  - type: remove
    target: firstName
  - type: remove
    target: lastName
```

Note the transformed result is what's stored — tests assert with `expectedAttribute` after transforms.

## persist

Keep the value across sessions/restarts via a storage module installed in the app ([modules.md](modules.md)):

```yaml
persist: localstorage
```

Conditional and multi-storage forms:

```yaml
persist:
  conditions:
    - attribute: gdprConsent
      operator: equals
      value: true
  storage: localstorage
```

```yaml
persist:
  - conditions:
      - attribute: platform
        operator: equals
        value: web
    storage: localstorage
  - conditions:
      - attribute: platform
        operator: equals
        value: ios
    storage: userdefaults
```

Apps using persisted attributes should `await eventvisor.onReady()` before tracking, so persisted values are loaded first. On datafile refresh, active in-memory attributes are preserved, newly persisted definitions initialize, and deleted definitions' state is removed.

## Application side

```js
await eventvisor.setAttribute("userId", "user-123");
eventvisor.getAttributeValue("userId");
eventvisor.getAttributes();
eventvisor.isAttributeSet("userId");
await eventvisor.removeAttribute("userId");
```

## Deprecating and archiving

Same semantics as events: `deprecated: true` warns but works; `archived: true` removes from datafiles. Check `npx eventvisor find-usage attribute <name>` before removing — conditions, sampling keys, `requiredAttributes`, and effect triggers may reference it.
