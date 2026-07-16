# React SDK reference

Full docs: <https://eventvisor.org/docs/sdks/react> (React Native: <https://eventvisor.org/docs/sdks/react-native>)

`@eventvisor/react` provides a provider and hooks **around** a JavaScript SDK instance — create the instance with `createEventvisor` as usual ([sdk-javascript.md](sdk-javascript.md)), then hand it to the provider.

```bash
npm install @eventvisor/sdk @eventvisor/react
```

## Provider

```jsx
import { createEventvisor } from "@eventvisor/sdk";
import { EventvisorProvider } from "@eventvisor/react";

const eventvisor = createEventvisor({ datafile, modules: [...] });

root.render(
  <EventvisorProvider instance={eventvisor}>
    <App />
  </EventvisorProvider>,
);
```

## Hooks

```jsx
import { useEventvisor, useEventvisorReady, useEventvisorInstance } from "@eventvisor/react";

function App() {
  const ready = useEventvisorReady();          // only matters with persistence modules
  return ready ? <Routes /> : <Loading />;
}

function CheckoutButton() {
  const { track, setAttribute, removeAttribute, getAttributeValue, isAttributeSet } =
    useEventvisor();

  return (
    <button onClick={() => track("checkout_started", { source: "header" })}>
      Checkout
    </button>
  );
}

// escape hatch: the raw instance (setDatafile, on, diagnostics, spawn…)
const instance = useEventvisorInstance();
```

Facts that prevent the common mistakes:

- Hooks **throw a clear error outside `EventvisorProvider`** — wrap the tree first.
- The methods returned by `useEventvisor()` are bound and **referentially stable** while the provider's instance is unchanged — safe in dependency arrays and event handlers without re-render churn.
- Swapping the `instance` prop resets readiness and rebinds methods — the supported way to hot-swap datafile environments.
- Track on interactions/effects, not during render; `track` is async and returns the transformed payload or `null`.

## React Native

Same two packages, same API. Add a `TextEncoder` polyfill if the runtime lacks it (`fastestsmallesttextencoderdecoder`).

## Typed usage

Generated bindings ([code-generation.md](code-generation.md)) pair well with React: call `setInstance(eventvisor)` once at startup, then import typed `track`/`setAttribute` anywhere — with or without the hooks.
