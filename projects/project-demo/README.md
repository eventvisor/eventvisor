# project-demo

A practical Eventvisor project for an e-commerce application. It demonstrates:

- shared customer and session attributes;
- storefront and checkout event schemas;
- destination conditions and payload transforms;
- an effect with state;
- dependency-aware Targets;
- event, attribute, destination, and effect tests;
- matrix assertions for product and currency combinations.

Try it directly:

```sh
npx eventvisor lint
npx eventvisor test
npx eventvisor build
npx eventvisor catalog serve
```

Or use it as a starting point:

```sh
mkdir my-eventvisor-project && cd my-eventvisor-project
npx @eventvisor/cli init --project=demo
npm install
```
