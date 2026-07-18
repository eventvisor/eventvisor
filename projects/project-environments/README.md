# project-environments

This project models `development`, `staging`, and `production` as isolated Eventvisor Sets. Each release lane owns its definitions, tests, state, datafiles, generated code, and Catalog data.

The same `order_submitted` event exists in every set, while its generated `releaseLane` value makes each set visibly independent.

```sh
npx eventvisor lint
npx eventvisor test
npx eventvisor build

npx eventvisor test --set=staging
npx eventvisor build --set=production
```

The project also defines one-way promotion flows. Preview first, then apply after reviewing the
dependency-aware plan:

```sh
npx eventvisor promote --from=development --to=staging
npx eventvisor promote --from=development --to=staging --apply --audit
```

Use it as a starter with `npx @eventvisor/cli init --project=environments`.
