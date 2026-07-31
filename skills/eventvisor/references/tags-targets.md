# Tags and Targets reference

Full docs: <https://eventvisor.org/docs/tags> and <https://eventvisor.org/docs/targets>

Tags are coarse labels on entities. Targets turn those labels and key patterns into named, reviewable, dependency-aware datafiles.

## Tags

Every entity (event, attribute, destination, effect) carries `tags:`; the allowed list lives in `eventvisor.config.js`:

```js
module.exports = {
  tags: ["all", "web", "mobile", "backend"],
};
```

```yaml
# events/page_view.yml
tags: [all, web]
```

Tags do not emit datafiles. Target definitions, Catalog filters, code generation, and supported CLI commands use them as selection metadata. Tagging an entity with a tag not in the config fails lint.

Typical schemes: per platform (`web`/`mobile`/`backend`), per microfrontend (`products`/`checkout`/`account`), plus an `all` umbrella. Tags are about **datafile size and scope**, not security or ownership — for ownership use CODEOWNERS ([recipes.md](recipes.md#ownership)).

## Targets

Targets (`targets/*.yml`) define application-specific datafiles as an explicit contract: include/exclude patterns per entity type, refined by tags, with runtime dependencies retained automatically.

```yaml
# targets/checkout.yml
description: Checkout web application        # required
tag: web                                     # entities must ALSO carry this tag (AND semantics)
includeEvents:
  - add_to_cart
  - checkout_*                               # single * gives glob-like matching
excludeEvents: checkout_internal_*
includeAttributes: [userId, sessionId]
includeDestinations: "*"
includeEffects: cart_*
excludeEffects: ""                           # each include* has a matching exclude*
pretty: true                                 # per-target datafile formatting
stringify: true                              # compact condition stringification
revisionFromHash: true                       # content-derived revision (stable cache keys)
```

- Include/exclude fields accept one pattern, an array, or `"*"`.
- `tag:` selects one tag; `tags:` expresses OR/AND: `tags: {and: [web, checkout]}` / `tags: {or: [web, mobile]}`.
- Tag criteria and target patterns combine with **AND** — an entity must satisfy both.

### Dependency closure (why Targets beat manual tag juggling)

The builder keeps a selected datafile _usable_ by pulling in what selections need, transitively:

- An included **effect** brings the events and attributes that can trigger it.
- Included **events** retain their `requiredAttributes` and anything referenced through sources — `attribute: userId`, `source: attributes.userId`; a collection source like `source: attributes` retains the whole collection.
- **Reusable Schemas** referenced by selected events/attributes are resolved and inlined (Schemas are build dependencies, not selectors — no include/exclude for them).
- `archived: true` always removes a definition. An explicit `exclude*` that conflicts with a required runtime dependency fails the build and reports the conflicting dependency.

### Building and consuming

```bash
npx eventvisor build --target checkout
npx eventvisor build --target checkout --target account   # several at once
```

Output: `datafiles/eventvisor-checkout.json`. Apps may load and merge several Target datafiles because `setDatafile` merges by default ([sdk-javascript.md](sdk-javascript.md#updating-a-datafile)).

Targets also scope other commands: `test --target checkout`, `simulate <event> --target checkout`, `generate-code --target checkout` — useful for "does this app's datafile behave correctly" questions.

## Choosing

- One app, one team → create one broad Target, optionally selecting one tag.
- Several surfaces sharing a project → use one Target per deployable application or service.
- Renaming/removing anything a Target references? `npx eventvisor find-usage` first; lint catches dangling patterns only if they match nothing at all.
