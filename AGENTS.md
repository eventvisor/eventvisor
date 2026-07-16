# Overview <!-- omit in toc -->

This is the original monorepo of Eventvisor, which is a Git-based analytics events schema management tool offering a CLI and also a SDK (intended to be in several different languages, but this monorepo has the original TypeScript/JavaScript SDK only).

- [Links](#links)
- [Stack](#stack)
- [Packages](#packages)
- [Examples](#examples)
- [Installation](#installation)
- [Building](#building)
- [Testing](#testing)
- [Linting](#linting)
- [Formatting](#formatting)

## Links

- Website: https://eventvisor.org
- GitHub: https://github.com/eventvisor/eventvisor
- Documentation index: https://eventvisor.org/llms.txt
- Complete documentation: https://eventvisor.org/llms-full.txt

## Stack

- The monorepo is managed with Lerna
- Using Node.js v24+
- Using npm workspaces
- Using TypeScript

## Packages

They can be found in the `packages/` directory which are published to npm.

Individual packages can be built and tested by `cd`ing into the package directory and then running `npm run build` and `npm run test` respectively.

- `packages/types`: TypeScript types for all other packages
- `packages/core`: Core package used in Eventvisor CLI
- `packages/cli`: Eventvisor CLI package
- `packages/sdk`: Eventvisor SDK package
- `packages/react`: Additional React-specific hooks and components
- `packages/catalog`: Static project Catalog used by the CLI

The SDK is created with `createEventvisor(options)`. Its public contract uses asynchronous operations, modules, diagnostics, typed events, merge-by-default datafile updates, and explicit `close()` cleanup. `addModule()` returns an asynchronous, idempotent removal callback. Failed setup must clean module subscriptions and resources. Do not restore `DatafileReader`, custom logger construction, or old async aliases as public APIs. Keep package `files` lists narrow, declare dependencies referenced by published types, inspect `npm pack --dry-run`, and verify CommonJS and ESM entry points before publishing.

The project model includes reusable Schemas under `schemas/`, Targets for focused dependency-aware datafiles, and Sets for multiple isolated projects in one repository. Events, attributes, nested properties, and array items can reference a Schema with `schema: <key>`. Core resolves transitive references at build time and inlines them into events and attributes, so SDK datafiles have no separate Schema collection. Linting rejects missing and circular references. Combined Target and tag filters use AND semantics. Target dependency closure includes required attributes, named and collection-wide sources, effect trigger events and attributes, and reusable Schema dependencies, while exclusions and archived definitions continue to win. Condition groups, test specs, and matrix dimensions must be nonempty in both lint schemas and public TypeScript contracts. Malformed stringified runtime conditions fail closed.

Direct `source`, `attribute`, `state`, `effect`, `payload`, and `lookup` properties accept one source or a nonempty ordered array. Transform `value` remains the operand for increment and decrement when a target is present, and the current target value is the numeric input.

Catalog exports require a dedicated output directory. Core rejects filesystem roots, home directories, project roots, and directories containing the project. Use `--base-path` for deployments below an origin path. Catalog matrix cases are expanded by the core tester implementation before being written for the UI.

## Examples

Example projects are available as packages in the `projects/` directory, which are for testing and development purposes only, and not published to npm.

The `projects/project-1` project is used for testing and development purposes covering all possible use cases. You can run `npx eventvisor ...` commands there to test things out quickly while changing/adding any definitions in that project.

Additional reference projects cover common starting points:

- `project-demo`: e-commerce storefront, checkout, Targets, routing, transforms, effects, and matrix tests
- `project-no-environments`: minimal standalone project without Sets
- `project-environments`: development, staging, and production modeled as Sets
- `project-test-environments`: richer environment-specific and matrix testing
- `project-yml` and `project-json`: parser format examples
- `project-monorepo`: multiple independently configured npm workspace projects

Every `project-*` directory is also a named CLI initializer scaffold. For example, `npx @eventvisor/cli init --project=demo` reads `projects/project-demo` from the public repository.

YAML is the default file format for the example projects, but Eventvisor projects also allow other formats via its custom parsers API.

## Installation

Dependencies of entire monorepo can be installed via:

```
$ make install
```

## Building

All the packages in the monorepo can be built via:

```
$ make build
```

To specifically build a particular package, you can `cd` into the package directory and then run `npm run build`:

```
$ (cd packages/core && npm run build)
```

## Testing

All the packages in the monorepo can be tested via:

```
$ make test
```

To specifically test a particular package, you can `cd` into the package directory and then run `npm run test`:

```
$ (cd packages/core && npm run test)
```

## Linting

All the packages in the monorepo can be linted via:

```
$ make lint
```

Uses both ESLint and Prettier to lint the code everywhere.

## Type checking

```sh
make typecheck
```

Run the complete release-oriented sequence with `make check`.

Run `make test-browser` for the Playwright Catalog smoke test against `project-1`. Run `make release-check` before publishing to inspect every tarball and load declared CommonJS and ES module entries.

## Formatting

To automatically format the code everywhere, run:

```
$ make format
```
