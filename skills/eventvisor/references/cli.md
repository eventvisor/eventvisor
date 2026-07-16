# CLI reference

Full docs: <https://eventvisor.org/docs/cli>

Run through `npx eventvisor` inside a project (or `npx @eventvisor/cli` for `init`). Any command + `--help` prints its typed options. `--rootDirectoryPath <path>` (also `--root-directory-path`, `--projectDirectoryPath`) runs against another checkout. In Sets projects, project commands accept `--set`; without it they process every set.

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
npx eventvisor build                          # all tag datafiles + all target datafiles
npx eventvisor build --tag=web                # one tag
npx eventvisor build --target=checkout --target=account   # repeatable
npx eventvisor build --tag=web --json --pretty             # PRINT one datafile, no files written
npx eventvisor build --revision=100
npx eventvisor build --revision-from-hash     # content-derived revision (stable caching)
npx eventvisor build --datafilesDir=<dir>
```

Notes: normal builds write `datafiles/` and bump the incremental revision under `.eventvisor/` — CI usually owns committing that state (or use `--revision-from-hash` and skip it). `--json` requires a single selection (and a single `--set` in Sets projects).

## Simulate and benchmark

```bash
npx eventvisor simulate page_view --value='{"url":"https://example.com"}' \
  --attributes='{"userId":"user-123","consentAnalytics":true}' [--tag=web|--target=checkout] [--json]

npx eventvisor benchmark page_view -n 1000000 --value='{"url":"https://example.com"}'
```

`simulate` runs the real pipeline (validation → conditions → sample → transforms → destinations) against a freshly built datafile and prints the outcome — the primary debugging tool. `benchmark` warms up the SDK, then reports min/avg/max/p50/p95/p99 per evaluation in microseconds.

## Code generation

```bash
npx eventvisor generate-code --language typescript --out-dir src/eventvisor \
  [--tag web]... [--target checkout]...
```

See [code-generation.md](code-generation.md).

## Catalog

```bash
npx eventvisor catalog                        # export to out/ + serve locally, prints URL
npx eventvisor catalog export [--base-path /event-catalog] [--out-dir <dir>] [--no-assets]
npx eventvisor catalog serve --port 3000
npx eventvisor catalog --hash-router          # only when the host can't serve index.html fallbacks
```

Export refuses unsafe output locations (project root, home dir, a directory containing the project). See [querying.md](querying.md).

## Version

```bash
npx eventvisor --version
```
