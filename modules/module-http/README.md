# @eventvisor/module-http

Reliable batching HTTP transport for Eventvisor. It provides a bounded in-memory queue, timed and size-based batches, exponential retries, diagnostics, and explicit flushing.

```js
import { createEventvisor } from "@eventvisor/sdk";
import { createHttpModule } from "@eventvisor/module-http";

const eventvisor = createEventvisor({
  datafile,
  modules: [
    createHttpModule({
      url: "https://events.example.com/collect",
      batchSize: 20,
      flushIntervalMs: 1000,
      maxQueueSize: 1000,
      maxRetries: 2,
    }),
  ],
});
```

Use `transport: http` in a destination. `url` may be a string or a function of transport metadata. Customize `headers`, `fetch`, and `buildBody` when required.

The queue is memory-only. A successful `track()` means the module accepted or attempted the event, not that a remote server stored it. Call `await eventvisor.flush()` before controlled shutdown. Terminal delivery and queue overflow failures are reported through diagnostics.

See https://eventvisor.org/docs/modules/http/ for the complete contract.

## License

MIT © [Fahad Heylaal](https://fahad19.com)
