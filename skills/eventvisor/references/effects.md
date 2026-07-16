# Effects reference

Full docs: <https://eventvisor.org/docs/effects>, <https://eventvisor.org/docs/handlers>, <https://eventvisor.org/docs/persistence>

Effects are declaratively-defined side-effects that fire when events are tracked or attributes are set — injecting a marketing pixel after consent, counting activity, kicking off custom app logic. The SDK core does nothing on its own; each step's `handler` is a module the app installs. One file per effect in `effects/`.

## Complete shape

```yaml
# effects/marketing_pixel.yml
description: Inject the marketing pixel once   # documentation only
tags: [web]                                    # must be from eventvisor.config.js tags

on:                                            # trigger(s) — required
  event_tracked:
    - page_view                                # specific events…
  attribute_set:
    - gdprConsent                              # …and/or specific attributes

state:                                         # optional internal state, any JSON value
  injected: false

conditions:                                    # gate before steps run (can read state)
  - state: injected
    operator: equals
    value: false

steps:                                         # executed in order when triggered + conditions pass
  - description: inject the script
    handler: pixel                             # module installed in the app
    params:                                    # arbitrary params passed to the handler
      snippet: |
        <script>
          console.log("Pixel injected from {{ payload.url }}");
        </script>
      selector: body
    continueOnError: false                     # default: a failing step stops the rest

  - description: remember we did it
    transforms:                                # steps can transform the effect's own state
      - type: set
        target: injected
        value: true

persist: localstorage                          # optional: state survives restarts
archived: false
```

## Triggers (`on`)

```yaml
on: [event_tracked]                # any event
on: [attribute_set]                # any attribute
on: [event_tracked, attribute_set] # both, any key

on:                                # specific keys (the usual form)
  event_tracked: [page_view, add_to_cart]
  attribute_set: [gdprConsent]
```

Effects fire **after** the event has passed validation, conditions, sampling, and event-level transforms — a dropped event triggers nothing. The transformed payload is what the effect sees as `payload`.

## State

`state` is the effect's private memory, initialized from the definition and living for the SDK instance's lifetime (or longer, with `persist`). Read it in conditions with the `state:` source; write it via step `transforms` (which operate on **state**, not the event payload):

```yaml
steps:
  - transforms:
      - state: itemCount        # numeric input comes from state.itemCount
        type: increment
        target: itemCount
```

## Steps

Each step may have: `description`, `handler` + `params`, `transforms` (state-mutating), its own `conditions`, and `continueOnError: true` to let later steps run if this one fails. Steps run synchronously in order. Handler failures stop remaining steps unless `continueOnError` is set.

Handler `params` string values support `{{ source.path }}` interpolation (e.g. `{{ payload.url }}`, `{{ attributes.userId }}`).

## Handlers (application side)

A handler is a module method. Official: `pixel` (`@eventvisor/module-pixel`) injects `snippet` HTML/script at `selector`. Custom:

```ts
export function createCustomModule() {
  return {
    name: "custom",
    handle: async ({ effectName, effect, step }) => {
      const { params } = step;
      // do the side-effect
    },
  };
}
```

Registered via `createEventvisor({ modules: [createCustomModule()] })`. See [modules.md](modules.md).

## Persistence

Same `persist` grammar as attributes ([attributes.md](attributes.md#persist)): a storage module name, a conditional `{conditions, storage}` object, or an array of them. With `persist: localstorage` the "fire once ever" pattern survives full page reloads. Apps should `await eventvisor.onReady()` so persisted state loads before events fire.

## Testing effects

Effect specs assert state and handler calls — including "handled at most once":

```yaml
effect: marketing_pixel
assertions:
  - description: fires once across repeated page views
    actions:
      - type: track
        name: page_view
        value: { url: "https://example.com" }
      - type: track
        name: page_view
        value: { url: "https://example.com/about" }
    expectedState:
      injected: true
    expectedToBeCalled:
      - handler: pixel
        times: 1
```

See [testing.md](testing.md).

At runtime, `eventvisor.getStateValue("<effectName>")` reads the current state — useful when debugging "why didn't it fire again?" in a live app.

## Cautions

- An effect's triggers create hidden dependencies: Targets automatically pull in the events/attributes that can trigger an included effect, and `find-usage` reveals them — check before renaming/removing trigger keys.
- Keep security posture explicit: effects can inject scripts into pages. That's the point (engineering oversight over GTM-style injection — see [recipes.md](recipes.md#marketing-pixels-with-oversight)), so route changes through review like any code.
