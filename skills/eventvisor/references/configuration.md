# Configuration reference

Full docs: <https://eventvisor.org/docs/configuration> and <https://eventvisor.org/docs/parsers>

Every project has `eventvisor.config.js` at its root:

```js
/** @type {import('@eventvisor/core').ProjectConfig} */
module.exports = {
  tags: ["all", "web", "backend"],   // allowlist for selection metadata
  sets: false,                       // true -> isolated projects under sets/ (see sets.md)
  parser: "yml",                     // "yml" (default) | "json" | custom parser object
  prettyDatafile: false,             // format generated JSON for humans
  stringify: true,                   // compact condition stringification in datafiles
  onValidationFailure: "drop",       // drop | deliverWithWarning | quarantine object
  promotionFlows: [                  // optional allowlist for Set promotion
    { from: "development", to: "staging" },
  ],
};
```

Inspect the resolved config any time:

```bash
npx eventvisor config            # human-readable
npx eventvisor config --json --pretty
```

## Directory path overrides

Each directory can be relocated; defaults are `<rootDir>/<plural>`:

- Entities: `eventsDirectoryPath`, `attributesDirectoryPath`, `destinationsDirectoryPath`, `effectsDirectoryPath`, `schemasDirectoryPath`, `targetsDirectoryPath`, `testsDirectoryPath`, `setsDirectoryPath`
- Output/state: `datafilesDirectoryPath` (default `datafiles/`), `catalogExportDirectoryPath` (default `out/`), `systemDirectoryPath` (default `.eventvisor/`, revision state)

If `npx eventvisor config` shows overrides, author in those paths, not the defaults.

## Parsers

```js
module.exports = { tags: ["web"], parser: "json" };   // author .json files instead of .yml
```

Custom parser (any format that parses to plain objects — e.g. TOML):

```js
module.exports = {
  tags: ["web"],
  parser: {
    extension: "toml",
    parse: (content) => require("toml").parse(content),
  },
};
```

With a custom parser, write **all** entity files in that format with that extension. Reference projects: `project-yml`, `project-json` in the monorepo.

## Related config surfaces

- Per-target `pretty` / `stringify` / `revisionFromHash` live on the Target definition, overriding project defaults for that datafile ([tags-targets.md](tags-targets.md)).
- `sets: true` restructures the whole tree — read [sets.md](sets.md) before touching such a project.
- The CLI accepts `--rootDirectoryPath <path>` to operate on a project from elsewhere.
