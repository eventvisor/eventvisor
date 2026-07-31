# @eventvisor/react <!-- omit in toc -->

React bindings for Eventvisor.

```bash
npm install @eventvisor/sdk @eventvisor/react
```

```tsx
import { createEventvisor } from "@eventvisor/sdk";
import { EventvisorProvider } from "@eventvisor/react";

const eventvisor = createEventvisor({ datafile });

root.render(
  <EventvisorProvider instance={eventvisor}>
    <App />
  </EventvisorProvider>,
);
```

Use `useEventvisorReady()` for readiness, `useEventvisorInstance()` for the instance, or `useEventvisor()` for stable bound methods.

```tsx
function CheckoutButton() {
  const ready = useEventvisorReady();
  const { track } = useEventvisor();

  return <button disabled={!ready} onClick={() => track("checkout.started", {})}>Checkout</button>;
}
```

Attribute hooks subscribe to SDK events and re-render only when the observed value changes:

```tsx
function UserSummary() {
  const country = useEventvisorAttribute("country");
  const { userId, plan } = useEventvisorAttributes(["userId", "plan"]);

  return <span>{userId} · {plan} · {country}</span>;
}
```

See the [React SDK documentation](https://eventvisor.org/docs/sdks/react/) for more information.

## License <!-- omit in toc -->

MIT © [Fahad Heylaal](https://fahad19.com)
