# Code generation reference

Full docs: <https://eventvisor.org/docs/code-generation>

Generate type-safe TypeScript bindings from the project's events and attributes — compile-checked event keys and payload/attribute types instead of stringly-typed `track` calls.

```bash
# from the project root
npx eventvisor generate-code --language typescript --out-dir src/eventvisor

# scope to what one app consumes (repeatable flags)
npx eventvisor generate-code --language typescript --out-dir src/eventvisor \
  --target checkout --target account
npx eventvisor generate-code --language typescript --out-dir src/eventvisor --tag web
```

Reusable Schema references (including transitive and nested ones) are resolved before types are emitted. Only TypeScript is supported today.

Ship the output to apps by copying it in or publishing it as a (private) package.

## Usage in the application

```ts
// once at startup
import { createEventvisor } from "@eventvisor/sdk";
import { setInstance } from "./eventvisor";   // generated

const eventvisor = createEventvisor({ datafile, modules: [...] });
setInstance(eventvisor);
```

```ts
// anywhere after
import { setAttribute, track } from "./eventvisor";

await setAttribute("userId", "user-123");     // key and value type checked
await track("page_view", {                    // payload type checked against the schema
  url: "https://www.yoursite.com/home",
});
```

## When to recommend it

- Multiple apps/teams consuming the project — typos become compile errors instead of runtime "unknown event" warnings.
- After renames/deprecations — regenerating surfaces every affected call site.
- CI idea: regenerate + `tsc --noEmit` in app repos to catch project/app drift before deploy.

Keep generated output out of manual edits; regenerate on project change (a `generate-code` npm script in the project repo, like `project-demo` has, makes this a one-liner).
