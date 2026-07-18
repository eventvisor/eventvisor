# Glossary

| Term                      | Meaning                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project**               | The Git repo of definitions (`events/`, `attributes/`, `destinations/`, `effects/`, `schemas/`, `targets/`, `tests/`) plus `eventvisor.config.js`. Separate from application code. |
| **Datafile**              | Static JSON built for a Target (`eventvisor-checkout.json`), served to apps, consumed by SDKs. Carries a `revision`.                                                               |
| **Event**                 | A structured analytics event or log an app tracks (`track("page_view", {...})`). Defined with a JSON Schema, optional level, conditions, sampling, transforms, and routing.        |
| **Attribute**             | Slow-changing context (userId, country, consent) set via `setAttribute`, validated by its own schema, referenced in conditions/sampling/transforms.                                |
| **Schema (reusable)**     | A shared JSON Schema fragment in `schemas/`, referenced with `schema: <key>`, inlined at build time.                                                                               |
| **Destination**           | A named place events are delivered (console, GA4, warehouse), with its own conditions/sampling/transforms. Names a transport.                                                      |
| **Transport**             | The delivery mechanism for a destination — a module method installed in the app.                                                                                                   |
| **Effect**                | A declarative side-effect triggered by tracked events / set attributes, with state, conditions, and handler steps.                                                                 |
| **Handler**               | The module method that executes an effect step (e.g. `pixel`).                                                                                                                     |
| **Lookup**                | An on-demand read through a module (`lookup: localstorage.consent`, `timestamp`, `uuid`) usable in conditions and transforms.                                                      |
| **Persistence / storage** | Module capability that keeps attribute values or effect state across sessions (`persist: localstorage`).                                                                           |
| **Module**                | An app-installed plugin providing transports, lookups, handlers, and/or storage. Referenced from YAML by name.                                                                     |
| **Condition**             | A source + operator + value check; combined with `and`/`or`/`not`. Used for filtering, routing, gating transforms/effects/sampling/validation.                                     |
| **Source**                | Where a condition/transform reads from: `source` (dotted path), `attribute`, `payload`, `state`, `lookup`.                                                                         |
| **Transform**             | A declarative data manipulation (set/remove/rename/concat/spread/append/trim/to*/increment/decrement) applied to payloads, bodies, attribute values, or effect state.              |
| **Sampling**              | Deterministic per-identity bucketing (`by` + `percentage`/`range`) that keeps a consistent subset of users' events.                                                                |
| **Filtering**             | Dropping events categorically via conditions (vs sampling's percentage).                                                                                                           |
| **Tag**                   | A label on entities; each configured tag builds its own datafile.                                                                                                                  |
| **Target**                | A named, dependency-aware datafile selection (`targets/*.yml`) with include/exclude patterns and tag criteria.                                                                     |
| **Set**                   | An isolated sub-project under `sets/<name>/` (often used as environments); commands take `--set`.                                                                                  |
| **Level**                 | Event severity (`fatal`…`debug`) transports can branch on.                                                                                                                         |
| **`requiredAttributes`**  | Attributes that must be set before an event may be tracked.                                                                                                                        |
| **`skipValidation`**      | Per-event validation bypass — boolean or conditional.                                                                                                                              |
| **Deprecated / archived** | Deprecated = works + warns (grace period); archived = removed from datafiles.                                                                                                      |
| **Revision**              | Datafile version identifier — incremental counter (state in `.eventvisor/`) or content hash (`--revision-from-hash`).                                                              |
| **Catalog**               | The exported/browsable UI of the whole project (entities, usage, history, tests).                                                                                                  |
| **Simulate**              | CLI command running the full pipeline on a hypothetical payload — the debugging tool.                                                                                              |
| **Diagnostics**           | Structured runtime reports from SDK/modules (`onDiagnostic`), covering validation failures, missing transports, module errors.                                                     |
| **`spawn()`**             | Child SDK instance sharing the parent's datafile with its own attributes/modules.                                                                                                  |
