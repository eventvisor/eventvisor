# @eventvisor/sdk

The universal Eventvisor SDK for Node.js and browsers.

```bash
npm install @eventvisor/sdk
```

```ts
import { createEventvisor } from "@eventvisor/sdk";

const eventvisor = createEventvisor({
  datafile,
  initialAttributes: { userId: "123" },
});

await eventvisor.onReady();
await eventvisor.track("checkout.completed", { orderId: "order-1" });
```

## Attributes

```ts
await eventvisor.setAttribute("country", "NL");
eventvisor.getAttributeValue("country");
eventvisor.getAttributes();
await eventvisor.removeAttribute("country");
```

## Modules and diagnostics

Modules provide lookups, transports, handlers, and storage. They can subscribe to diagnostics during setup and clean up resources when closed.

```ts
const eventvisor = createEventvisor({
  modules: [myModule],
  onDiagnostic(diagnostic) {
    reportDiagnostic(diagnostic);
  },
});

const removeModule = eventvisor.addModule(anotherModule);
await removeModule?.();
```

Modules can also be removed by name with `await eventvisor.removeModule(anotherModule.name)`.

## Updating datafiles

Datafiles merge by default. Pass `true` to replace the current datafile.

```ts
await eventvisor.setDatafile(nextDatafile);
await eventvisor.setDatafile(nextDatafile, true);
```

Invalid JSON reports an `invalid_datafile` diagnostic containing the phrase `Could not parse datafile`.

## Events and lifecycle

```ts
const unsubscribe = eventvisor.on("event_tracked", ({ eventName, value }) => {});
const child = eventvisor.spawn({ initialAttributes: { surface: "checkout" } });

unsubscribe();
await child.close();
await eventvisor.close();
```

Closing an instance releases module, event, and diagnostic subscriptions. See the [JavaScript SDK documentation](https://eventvisor.org/docs/sdks/javascript) for the complete API.

## License

MIT © [Fahad Heylaal](https://fahad19.com)
