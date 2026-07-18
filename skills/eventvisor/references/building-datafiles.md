# Building and deploying datafiles

Full docs: <https://eventvisor.org/docs/building-datafiles> and <https://eventvisor.org/docs/deployment>

Datafiles are the static JSON files SDKs consume. A normal build generates one per Target:

```bash
npx eventvisor build
```

```text
datafiles/
├── eventvisor-checkout.json
└── eventvisor-account.json
```

Selective builds: `--target checkout` (repeatable), `--set staging`, and optional `--tag web` filtering. Print without writing: `--tag/--target … --json --pretty` (Sets projects must pass one `--set`). Tags are selection metadata and do not create artifacts. Datafiles contain `schemaVersion`, `revision`, `eventvisorVersion`, the validation failure policy, and resolved runtime maps. Reusable Schemas are inlined and Target dependency closure is already applied.

## Revisions

- **Incremental** (default): a counter persisted under `.eventvisor/` — commit that directory (CI usually does, with `[skip ci]`) so numbering continues across builds.
- **Hash-based**: `npx eventvisor build --revision-from-hash` (or `revisionFromHash: true` per Target) derives the revision from content — unchanged content keeps identical bytes and cache keys, and no state needs committing. Prefer this in monorepos and most CI setups.
- Explicit: `--revision=123`.

Apps read it via `eventvisor.getRevision()` — the way to confirm a deploy actually reached an app.

## Deployment

Eventvisor is unopinionated; the recommended shape is: **project repo → CI → CDN**, keeping datafile deploys decoupled from app deploys (that decoupling is what makes remote control work). Bundling datafiles into app code works but ties every tracking change to an app release — call that out when users propose it.

### GitHub Actions

Two workflows:

```yaml
# .github/workflows/checks.yml — every push to non-main branches
name: Checks
on:
  push:
    branches-ignore: [main]
jobs:
  checks:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx eventvisor lint
      - run: npx eventvisor test
      - run: npx eventvisor build
```

```yaml
# .github/workflows/publish.yml — every push to main
name: Publish
on:
  push:
    branches: [main]
jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx eventvisor lint
      - run: npx eventvisor test
      - run: npx eventvisor build --revision-from-hash
      - name: Upload datafiles
        run: |
          # upload the datafiles/ directory to your CDN here
          echo "Uploading…"
```

With incremental revisions instead of `--revision-from-hash`, add a step committing `.eventvisor/` back with a `[skip ci]` message. Repo setting: Actions → General → Workflow permissions → Read and write.

Cloudflare Pages (or any static host) works the same way: publish the `datafiles/` directory; docs at <https://eventvisor.org/docs/deployment/cloudflare-pages>.

### Serving considerations

- Set long cache TTLs + hash revisions, or short TTLs + incremental — either way apps control freshness by how often they re-fetch ([sdk-javascript.md](sdk-javascript.md#updating-a-datafile)).
- CORS: apps fetch from the browser, so the CDN must allow the app origins.
- The Catalog can be deployed alongside (`npx eventvisor catalog export --base-path /event-catalog`) as the team-facing tracking plan.

## "When will my change be live?"

merge → CI (lint, test, build) → CDN upload → each app's next datafile fetch. An app fetching at startup only picks it up on next load; an app polling every 15 minutes lags up to 15 minutes; bundled datafiles wait for the next app release. There is no faster emergency path than the datafile refresh — that argues for CDN + refresh over bundling.
