# Upgrading a project from 0.x to v1

Full docs: <https://eventvisor.org/docs/migrations/v1>

Use this when the user is on a 0.x release and asks to upgrade, or when you find 0.x-only shapes: `eventvisor-tag-<tag>.json` datafile names, `statesDirectoryPath` in the config, `createInstance` or `registerModule` in app code, a `logger` option, or events without `type: object`.

Establish what they are actually on first:

```bash
npm ls @eventvisor/cli                                      # in the project repo
npm ls @eventvisor/sdk @eventvisor/react                    # in each app repo
npm ls | grep @eventvisor/module-                           # module versions matter too
```

## Applications first, then the project

The order is the opposite of what people expect, and the docs are explicit about it:

1. **Prepare the applications.** Upgrade `@eventvisor/sdk`, `@eventvisor/react`, and every `@eventvisor/module-*` package to v1 together, update custom module code, and deploy. A v1 SDK can read the 0.x datafiles you are still publishing.
2. **Upgrade the project.** Update the CLI, add Targets, fix definitions and tests, then lint, test, build, and deploy v1 datafiles.

Datafiles keep schema version `1` throughout, so the two halves can ship separately. Say this explicitly, because teams assume a lockstep migration and postpone the whole thing.

**Node.js 24 or newer is required** for the v1 CLI. That is a real gate: check it before promising a timeline.

## Project and CLI

```bash
npm install --save @eventvisor/cli@1
npx eventvisor lint      # the error list is the worklist
```

| 0.x                                          | v1                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Every configured tag produced a datafile      | **Tags are selection metadata only.** Named [Targets](tags-targets.md) produce datafiles                  |
| `datafiles/eventvisor-tag-web.json`           | `datafiles/eventvisor-web.json`, named after the Target                                                   |
| No Targets needed                             | **Every project or Set needs at least one Target**, or a build produces nothing                            |
| `statesDirectoryPath`, `states/` entity type  | Removed. Effect state lives inside the effect definition, no migration needed                              |
| Parsers built into core                       | `@eventvisor/parsers`, installed via the CLI. `parser: "yml"` and `"json"` keep working                    |
| Custom parser with `parse`                    | Custom parsers must implement **both** `parse` and `stringify`, because promotion performs editorial writes |
| `eventvisor catalog` was one-shot             | Bare `catalog` now exports, serves, watches, and live-reloads. `catalog export` and `catalog serve` stay one-shot |

The rename of datafile artifacts is the change most likely to break something outside the repo: **every application URL and deployment script that references `eventvisor-tag-<tag>.json` has to change**. If you cannot coordinate that, name the Targets `tag-web`, `tag-backend`, and so on to keep the old filenames.

New in v1 and worth raising if it fits their problem: reusable [Schemas](schemas.md) under `schemas/`, [Sets](sets.md) with promotions, and the `list` / `info` / `find-usage` / `simulate` / `benchmark` inspection commands.

## Definitions

Lint will surface most of these, but three change behaviour silently rather than failing:

- **`not` now means "not all of these".** Direct children of `not` are an implicit AND, then negated. To keep the old "none of these match" meaning, wrap the children in an explicit `or` group. That grouped form means the same thing in both 0.x and v1 SDKs, so rewrite it **before** you deploy either half of the migration. See [conditions.md](conditions.md).
- **Sampling now follows the documented 0 to 100 scale.** Percentages compare against the correct bucket scale, ranges are start inclusive and end exclusive, conditional sample arrays use the first matching rule, and a missing or empty bucket key fails closed. Bucketing itself is unchanged, so the same users stay in the same buckets, but the amount of traffic selected can move. Measure with `simulate` and a staging application before rollout rather than assuming volumes hold.
- **Effect steps stop on error by default.** In 0.x a failed step could continue; in v1 a failed handler stops the remaining steps. Add `continueOnError: true` only where later steps are still safe and meaningful.

The rest fail loudly:

- Every event must resolve to `type: object`, directly or through a Schema.
- Object payloads reject undeclared properties. Opt out at the right boundary with `additionalProperties: true` during gradual adoption, then remove it.
- Regular expressions accept only unique `g`, `i`, `m`, `s` flags. Lookaround, named and non-capturing groups, backreferences, inline modes, atomic groups, and possessive quantifiers are rejected. `before` and `after` need full ISO 8601 values with a timezone.
- Empty `and`, `or`, and `not` groups are rejected by lint and fail closed at runtime.
- A definition cannot set several direct source fields at once, and transform options are validated per transform type.

Also new: [validation failure policies](events.md). The project default is `drop`; `onValidationFailure: "deliverWithWarning"` in `eventvisor.config.js` is a useful temporary setting **during** a migration, and per-event quarantine routes invalid payloads to one destination for inspection.

## Tests

- Every spec needs at least one assertion, and every assertion needs a meaningful action and expectation.
- A `--keyPattern` or `--assertionPattern` that matches nothing now fails instead of reporting a false pass. Watch for this in CI right after upgrading.
- Pipeline acceptance has its own expectation now, so a spec that only asserted validity may need `expectedToBeTracked`.
- The unused event assertion `at` field and the `expectedToBeBatched` / `expectedBatchedCount` fields are gone. Use `expectedBody`, `expectedBodies`, and `assertAfter` for destination behaviour.
- A matrix must contain at least one key, and every key at least one value.

## Applications

Mechanical renames first:

| 0.x                 | v1                                    |
| ------------------- | ------------------------------------- |
| `createInstance`    | `createEventvisor`                    |
| `registerModule()`  | `addModule()`                          |
| `Module` type       | `EventvisorModule`                     |
| `logger` option, `createLogger` | `logLevel` plus `onDiagnostic` |

Then the behavioural changes, which renaming will not catch:

- **Operations are asynchronous.** `track`, `setAttribute`, `removeAttribute`, `setDatafile`, `removeModule`, `flush`, and `close` return promises and are processed in call order. Await them wherever completion or a result matters.
- **`setDatafile` merges by default.** Pass `true` to replace. It accepts a parsed object or a JSON string; a parse failure keeps the active datafile and reports a diagnostic containing `Could not parse datafile`. The `datafile_set` event now carries `{ replaced }`.
- **Internals are no longer public.** `DatafileReader`, managers, evaluators, and the logger factory are gone from the package root. Import only from the root.
- **Pixel scripts are disabled by default.** Any application relying on remotely configured script injection must opt in deliberately. Read [security.md](security.md) before doing so.
- Two new transports exist and are usually the right answer for real delivery: `@eventvisor/module-http` for bounded batching and retries, `@eventvisor/module-beacon` for browser page lifecycle delivery.

Module authors: the module API now exposes `getRevision`, `onDiagnostic`, `reportDiagnostic`, and cycle-safe `track`, plus `setup`, `flush`, and `close` lifecycle functions. Duplicate names and lifecycle failures are reported as diagnostics. See [modules.md](modules.md).

## Checklist

Applications, deployed first:

1. Upgrade `@eventvisor/sdk`, `@eventvisor/react`, and every `@eventvisor/module-*` package together.
2. Rename the factory, module registration, and logger usage.
3. Await the operations that are now asynchronous, and review `setDatafile` merge semantics.
4. Re-enable pixel scripts explicitly if the application depended on them.

Then the project:

5. Upgrade the CLI on Node.js 24 or newer.
6. Add a Target per consuming application or surface, and decide whether to preserve the old datafile filenames.
7. Remove `statesDirectoryPath`; give every event an object type; handle strict object properties.
8. Rewrite multi-child `not` groups with an explicit `or`, and fix regex flags and date values.
9. Re-check sampling volumes with `simulate` and a staging application.
10. Fix test specs, then run `lint`, `test`, and `build`, and compare the generated datafiles against what applications currently fetch.
11. Update CI, CDN paths, and any Catalog deployment to the new filenames and commands.
