# @eventvisor/catalog

The Eventvisor Catalog UI used by the CLI.

```bash
npx eventvisor catalog
```

The command exports and serves a browsable view of events, attributes, destinations, effects, reusable Schemas, Targets, tests, matrix cases, usage relationships, and Git history. Projects using Sets can switch between isolated set catalogs.

Catalog URLs use browser routing by default. Use `--hash-router` when deploying somewhere that cannot route application URLs back to `index.html`:

```bash
npx eventvisor catalog --hash-router
```

## Development

Run the Catalog against `projects/project-1` with live project data and browser updates:

```bash
npm run dev
```

Use another project or port when needed:

```bash
npm run dev -- --project=../../projects/project-environments --port=3001
```

Add `--hash-router` to develop against hash-based URLs explicitly.

Visit [https://eventvisor.org](https://eventvisor.org) for more information.

## License

MIT © [Fahad Heylaal](https://fahad19.com)
