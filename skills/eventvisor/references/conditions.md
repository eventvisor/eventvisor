# Conditions reference

Full docs: <https://eventvisor.org/docs/conditions>

Conditions gate almost everything: event filtering, destination routing, per-transform application, effect execution, conditional sampling, conditional validation skip, and conditional persistence.

## Anatomy

```yaml
conditions:
  - attribute: country      # a source (see sources.md): source | attribute | payload | state | lookup
    operator: equals
    value: us
```

A bare list of conditions is an implicit **AND**. `value` is omitted for `exists`/`notExists`. `regexFlags` accompanies `matches`/`notMatches`.

## Operators

| Operator                                                                                                                             | Operand                      | Meaning                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------- |
| `exists` / `notExists`                                                                                                               | —                            | Source resolves to a value / doesn't                     |
| `equals` / `notEquals`                                                                                                               | any                          | Equality                                                 |
| `greaterThan` / `greaterThanOrEquals` / `lessThan` / `lessThanOrEquals`                                                              | number                       | Numeric comparison                                       |
| `contains` / `notContains`                                                                                                           | string                       | Substring                                                |
| `startsWith` / `endsWith`                                                                                                            | string                       | Prefix / suffix                                          |
| `in` / `notIn`                                                                                                                       | string vs array value        | Source value is in `value: [a, b, c]`                    |
| `includes` / `notIncludes`                                                                                                           | array source vs scalar value | Source array contains `value`                            |
| `matches` / `notMatches`                                                                                                             | string                       | Regex (`value` is the pattern; optional `regexFlags: i`) |
| `before` / `after`                                                                                                                   | date string                  | Date comparison (ISO 8601)                               |
| `semverEquals` / `semverNotEquals` / `semverGreaterThan` / `semverGreaterThanOrEquals` / `semverLessThan` / `semverLessThanOrEquals` | semver string                | Version comparison                                       |

Watch the `in` vs `includes` distinction: `in` = scalar source ∈ array value; `includes` = array source ∋ scalar value.

```yaml
# in: country is one of these
- attribute: country
  operator: in
  value: [be, nl, lu]

# includes: permissions array contains "write"
- attribute: permissions
  operator: includes
  value: write

# regex with flags
- attribute: email
  operator: matches
  value: ^[^@]+@example\.com$
  regexFlags: i

# date window
- lookup: timestamp
  operator: after
  value: 2026-11-27T00:00:00Z
```

## Combining: and / or / not

```yaml
conditions:
  and:                       # all must match (same as a bare list)
    - { attribute: country, operator: equals, value: us }
    - { attribute: device, operator: equals, value: iPhone }
```

```yaml
conditions:
  or:                        # at least one must match
    - { attribute: country, operator: equals, value: us }
    - { attribute: country, operator: equals, value: ca }
```

```yaml
conditions:
  not:                       # negates the implicit AND of its children
    - { attribute: country, operator: equals, value: us }
```

**The `not` trap**: multiple direct children are ANDed **then** negated — `not: [A, B]` means "not (A and B)", not "neither A nor B". For "none of these match", wrap in `or`:

```yaml
conditions:
  not:
    - or:
        - { attribute: country, operator: equals, value: us }
        - { attribute: country, operator: equals, value: ca }
```

Mix freely and nest to any depth:

```yaml
conditions:
  - and:
      - { attribute: device, operator: equals, value: iPhone }
  - or:
      - { attribute: country, operator: equals, value: us }
      - { attribute: country, operator: equals, value: ca }
```

`and`, `or`, and `not` must each contain at least one child — empty groups fail lint.

## Semantics worth knowing

- Conditions evaluated during event processing see `payload` as the event's current (validated, possibly transformed-so-far) value, plus `eventName` and `eventLevel` as sources.
- Datafiles may carry conditions in stringified form (a build optimization via the `stringify` config); malformed stringified conditions **fail closed** at runtime — they match nothing rather than everything.
- Operator/value combinations are validated at lint time (e.g. `in` requires an array `value`).

# Conditions

Conditions use the same logical grammar whether they are emitted as objects or compact JSON
strings. Stringification is a datafile representation defined by schema version `1`, not a different
authoring syntax. SDKs parse and cache stringified conditions for the active datafile. Malformed
strings fail closed. Configure `stringify: false` globally or on a Target for readable datafiles.
