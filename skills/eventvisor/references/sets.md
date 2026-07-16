# Sets reference — isolated projects, environments, monorepos

Full docs: <https://eventvisor.org/docs/sets>, <https://eventvisor.org/docs/environments>, <https://eventvisor.org/docs/monorepo>

## Sets

Sets let one repository hold multiple **isolated** Eventvisor projects sharing one toolchain and config:

```js
// eventvisor.config.js
module.exports = {
  sets: true,
  tags: ["all", "web", "backend"],
};
```

```text
sets/
├── consumer/
│   ├── attributes/  events/  destinations/  effects/  schemas/  targets/  tests/
└── admin/
    └── …
```

**Everything moves under `sets/<set>/…`** — author in the right set. Commands process every set by default; select one with `--set`:

```bash
npx eventvisor lint --set consumer
npx eventvisor test --set consumer
npx eventvisor build --set consumer
```

Isolation is complete: datafiles land in `datafiles/sets/<set>/`, revision state in `.eventvisor/sets/<set>`, code generation can emit per set, and the Catalog gets a set selector (export under `out/sets/<set>`). `build --json` in a Sets project requires exactly one `--set`.

## Environments as Sets

Eventvisor has no first-class environment axis on entities. Two ways to model environments:

1. **An ordinary attribute** (`environment: production`) when all environments intentionally share one datafile — conditions/skipValidation can branch on it. Simple, but every lane ships together.
2. **Sets as release lanes** when development/staging/production need independent definitions, tests, and datafiles:

```text
sets/
├── development/
├── staging/
└── production/
```

The same event key can have different validation, routing, transforms, and tests per lane. Promotion between lanes is a copy-and-review Git change (there is no automated promote command — diff the two sets' files and port deliberately).

Reference scaffolds:

```bash
npx @eventvisor/cli init --project=environments        # dev/staging/production as Sets
npx @eventvisor/cli init --project=test-environments   # + richer env-specific matrix tests
```

## Monorepo (multiple `package.json` projects)

An alternative to Sets when projects want fully independent configs and dependency versions: separate Eventvisor projects as npm workspace packages:

```text
projects/
├── production/    # own package.json, own eventvisor.config.js
└── staging/
```

```bash
npx @eventvisor/cli init --project=monorepo
```

Each project keeps a unique package `name`. Root `make build|lint|test` fans out; all datafiles additionally merge into a root `datafiles/<project>/…` for one-shot CDN upload. Use `--revision-from-hash` per project so unchanged projects keep identical datafile bytes (better caching); or commit each project's `.eventvisor/` for incremental revisions.

## Choosing

| Need                                                                | Use                            |
| ------------------------------------------------------------------- | ------------------------------ |
| One team, one tree                                                  | No sets, no monorepo (default) |
| Same toolchain, isolated definition trees (env lanes, brand splits) | **Sets**                       |
| Independent configs/versions per project, shared repo + CI          | **Monorepo**                   |

If `sets: true` is on, remember in every flow: paths under `sets/<set>/`, `--set` on commands, per-set tests and targets.
