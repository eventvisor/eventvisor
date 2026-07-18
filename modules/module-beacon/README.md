# @eventvisor/module-beacon

Browser lifecycle-aware Beacon transport for Eventvisor. It batches events in memory, flushes on page exit or visibility changes, and falls back to keepalive fetch when needed.

```js
import { createEventvisor } from "@eventvisor/sdk";
import { createBeaconModule } from "@eventvisor/module-beacon";

const eventvisor = createEventvisor({
  datafile,
  modules: [createBeaconModule({ url: "/collect", batchSize: 20 })],
});
```

Use `transport: beacon` in a destination. `url` may be a string or a function. The module listens for `pagehide` and hidden-page transitions and uses keepalive `fetch` when Beacon is unavailable or rejects a batch.

The browser does not acknowledge Beacon ingestion, so delivery remains best effort. The bounded queue is memory-only. Call `await eventvisor.flush()` when the application has a controlled shutdown path.

See https://eventvisor.org/docs/modules/beacon/ for the complete contract.

## License

MIT © [Fahad Heylaal](https://fahad19.com)
