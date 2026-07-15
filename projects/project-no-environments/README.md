# project-no-environments

A small standalone Eventvisor project. It keeps definitions at the project root and does not use Sets or model release environments.

Use it as a minimal reference or as a starter:

```sh
mkdir my-eventvisor-project && cd my-eventvisor-project
npx @eventvisor/cli init --project=no-environments
npm install
npm run lint
npm test
npm run build
```

Generated datafiles are written to `datafiles/`.
