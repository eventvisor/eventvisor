# project-test-environments

This project focuses on testing Eventvisor Sets used as release environments. It demonstrates matrix assertions, environment-specific transforms, attribute-driven routing, and selecting one set from the CLI.

```sh
npx eventvisor test
npx eventvisor test --set=development
npx eventvisor test --set=staging --assertionPattern=internal
npx eventvisor test --set=production --onlyFailures
```

Definitions can be promoted through the configured release lanes. Promotion includes dependencies
and validates the destination set before keeping any writes:

```sh
npx eventvisor promote --from=development --to=staging
npx eventvisor promote --from=development --to=staging --apply
```

Use it as a starter with `npx @eventvisor/cli init --project=test-environments`.
