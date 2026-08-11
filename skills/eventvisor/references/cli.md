# CLI reference

Full docs: <https://eventvisor.org/docs/cli>

Requires **Node.js 24 or newer**. Run through `npx eventvisor` inside a project (or `npx @eventvisor/cli` for `init`). Any command + `--help` prints its typed options. `--rootDirectoryPath <path>` (also `--root-directory-path`, `--projectDirectoryPath`) runs against another checkout. In Sets projects, project commands accept `--set`; without it they process every set.

## init (new projects)

```bash
npx @eventvisor/cli init                      # minimal YAML scaffold in the current (empty) directory
npx @eventvisor/cli init --project=demo       # e-commerce reference (Targets, routing, transforms, effects, matrix tests)
npx @eventvisor/cli init --project=no-environments
npx @eventvisor/cli init --project=environments        # dev/staging/production as Sets
npx @eventvisor/cli init --project=test-environments   # richer env/matrix testing
npx @eventvisor/cli init --project=yml | json | monorepo
npx @eventvisor/cli init --force              # overwrite files in a non-empty directory
```

## Inspecting

```bash
npx eventvisor config [--json --pretty]
npx eventvisor list <entityType> [--keyPattern=<regex>] [--json --pretty]
npx eventvisor info <entityType> <key>
npx eventvisor find-usage <entityType> <key>
```

`<entityType>`: `event`, `attribute`, `destination`, `effect`, `schema`, `target`, `test`.

```bash
npx eventvisor list event --keyPattern="^checkout" --json
npx eventvisor info event page_view
npx eventvisor find-usage attribute userId      # conditions, sampling, requiredAttributes, effects…
npx eventvisor find-usage schema identifier
```

## Lint

```bash
npx eventvisor lint
npx eventvisor lint --entityType=event
npx eventvisor lint --keyPattern="order"
npx eventvisor lint --set=staging
```

Catches: schema violations, dangling references (Schemas, destinations, attributes), circular Schema references, tags not in config, per-type transform mistakes, empty condition groups, empty test specs/matrices.

## Test

```bash
npx eventvisor test
npx eventvisor test --keyPattern="order" --assertionPattern="consent"
npx eventvisor test --onlyFailures --quiet | --verbose
npx eventvisor test --tag=web | --target=checkout | --set=staging
```

## Build

```bash
npx eventvisor build                          # all Target datafiles
npx eventvisor build --target=checkout --target=account   # repeatable
npx eventvisor build --target=checkout --tag=web --json --pretty  # PRINT filtered JSON
npx eventvisor build --revision=100
npx eventvisor build --revision-from-hash     # content-derived revision (stable caching)
npx eventvisor build --datafilesDir=<dir>
```

Notes: normal builds write `datafiles/` and bump the incremental revision under `.eventvisor/` — CI usually owns committing that state (or use `--revision-from-hash` and skip it). `--json` prints instead of writing and leaves the stored revision untouched; it accepts **at most one** `--target` (none prints the whole project datafile) and requires one `--set` in Sets projects.

## Promote Sets

```bash
npx eventvisor promote --from=development --to=staging
npx eventvisor promote --from=development --to=staging --target=checkout --apply --audit
```

Preview is default. Promotion honors `promotionFlows`, `promotable: false`, dependencies, and conflict policy.

## Simulate and benchmark

```bash
npx eventvisor simulate page_view --value='{"url":"https://example.com"}' \
  --attributes='{"userId":"user-123","consentAnalytics":true}' [--tag=web|--target=checkout] [--json]

npx eventvisor benchmark page_view -n 1000000 --value='{"url":"https://example.com"}'
```

`simulate` runs the real pipeline (validation → conditions → sample → transforms → effects → destinations) against a freshly built datafile with all transports/handlers stubbed — no modules needed. It prints the final transformed payload, or `null` when the event was dropped; it does not print drop reasons or reached destinations (use `info` + a quick test spec for those — [querying.md](querying.md)). `benchmark` warms up the SDK, then reports min/avg/max/p50/p95/p99 per evaluation in microseconds.

## Code generation

```bash
npx eventvisor generate-code --language typescript --out-dir src/eventvisor \
  [--tag web]... [--target checkout]...
```

See [code-generation.md](code-generation.md).

## Catalog

```bash
npx eventvisor catalog                        # export to out/ + serve locally in WATCH MODE, prints URL
npx eventvisor catalog --port 3000            # watch mode on another port
npx eventvisor catalog export [--base-path /event-catalog] [--out-dir <dir>] [--no-assets]
npx eventvisor catalog serve --port 3000      # serve an existing export
npx eventvisor catalog --hash-router          # only when the host can't serve index.html fallbacks
```

Bare `catalog` watches definitions and `eventvisor.config.js`, rebuilds on change, and live-reloads open browser pages — the local-development mode. `catalog export` and `catalog serve` are intentionally one-shot (CI exports, serving existing output). Export refuses unsafe output locations (project root, home dir, a directory containing the project). See [querying.md](querying.md).

## Version

```bash
npx eventvisor --version
```
