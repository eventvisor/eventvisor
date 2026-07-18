# @eventvisor/module-pixel

Pixel module for Eventvisor. It can inject image pixels and HTML snippets declared by effects.

Script execution is disabled by default because datafile-driven scripts are executable content. If
your project intentionally uses script pixels, opt in and configure Content Security Policy support:

```ts
import { createEventvisor } from "@eventvisor/sdk";
import { createPixelModule } from "@eventvisor/module-pixel";

const eventvisor = createEventvisor({
  datafile,
  modules: [
    createPixelModule({
      allowScripts: true,
      nonce: () => document.querySelector("script[nonce]")?.nonce,
    }),
  ],
});
```

Only enable scripts for datafiles served over trusted TLS endpoints. Restrict allowed script sources
with CSP. Eventvisor reports a diagnostic when it blocks a script.

Visit [https://eventvisor.org/docs/modules/pixel/](https://eventvisor.org/docs/modules/pixel/) for more information.

## License

MIT © [Fahad Heylaal](https://fahad19.com)
