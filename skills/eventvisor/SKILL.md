---
name: eventvisor
description: Author, query, and integrate Eventvisor — Git-based governance, transformation, filtering, and routing of analytics events and logs. Use whenever the user mentions Eventvisor, works in a project containing eventvisor.config.js, edits files under events/, attributes/, destinations/, effects/, schemas/, targets/, or tests/, runs `eventvisor` CLI commands, or asks to define/validate/route/sample/filter/transform/deprecate analytics events, set up or audit a tracking plan, cut data ingestion costs, migrate analytics vendors, manage marketing pixels, or govern tracking schemas. Also use when consuming Eventvisor from app code — @eventvisor/sdk, @eventvisor/react, @eventvisor/module-*, createEventvisor, track/setAttribute, datafiles, transports, lookups, handlers. Covers starting a project from scratch, events, attributes, reusable Schemas, destinations, effects, conditions, transforms, sampling, tags, Targets, Sets, test specs, linting, building/deploying datafiles, simulation debugging, the Catalog, and code generation.
---

# Eventvisor

You are helping the user with [Eventvisor](https://eventvisor.org) — a Git-based analytics event management tool. An Eventvisor **project** is a repository of YAML (default) or JSON definitions that compile into static JSON **datafiles**, which applications consume locally through SDKs to validate, transform, filter, sample, and route tracked events to destinations — all controllable remotely without redeploying the apps. There are two sides to every task:

- **Project side** — authoring/querying the definitions repo (events, attributes, schemas, destinations, effects, targets, tests) and running the `eventvisor` CLI.
- **Application side** — consuming datafiles via `@eventvisor/sdk` (+ `@eventvisor/react`) and installing **modules** that provide transports, lookups, handlers, and storage.

This skill covers both. The compact documentation index is at <https://eventvisor.org/llms.txt> and the complete feed at <https://eventvisor.org/llms-full.txt> — fetch on demand if a topic isn't covered in this skill's references.

## Know your audience

Eventvisor is used by engineers, data/analytics teams, product managers, and marketers. Calibrate:

- **Not sure of the vocabulary?** Someone asking to "stop sending clicks to Google" wants a destination condition; "only track 10% of searches" wants sampling; "add a Meta pixel after cookie consent" wants an effect. Do the mapping for them, then show the result in their language: what changed, which events/destinations are affected, what happens next.
- **Safe vs. risky changes.** Adding a new event, loosening a schema, adding an optional property, adding a destination, raising a sample percentage — routine; do them confidently. **Tightening a schema (new `required` property, narrower type/enum), renaming an event or property, adding `requiredAttributes`, deleting a destination, lowering a sample, or changing what sampling buckets `by`** — these drop or reshape live data the moment the datafile deploys, while apps are still tracking the old shape. Warn plainly ("events from apps that don't send `plan` yet will be rejected and reach no destination") before proceeding, and prefer the deprecate-first ladder in [recipes.md](references/recipes.md#deprecating-safely).
- **Always close the loop.** After any change, say in one or two sentences what will happen when it ships (e.g. "once this merges and CI deploys the datafile, `search` events reach Segment for only ~10% of users; the rest are dropped before leaving the browser").
- For anyone who wants to _see_ the project, offer the **Catalog** — a browsable UI of every entity, its tests, usage, and Git history (see [Visual review with Catalog](#visual-review-with-catalog)).

## Orient yourself first

### No project yet? Interview, then scaffold

**If there is no `eventvisor.config.js`** anywhere in the working tree, there is no Eventvisor project yet. If the user is in an **application repo** consuming Eventvisor, this is SDK work — see [Application integration](#application-integration-sdk--modules); author definitions in the project repo, not here. If they want a new project, **ask a few setup questions before scaffolding** — these choices shape every file written afterwards:

1. **Who consumes the data → tags?** One app (a single `web` or `all` tag is fine) or several surfaces/teams (a tag per consumer — `web`, `mobile`, `backend`, or per microfrontend)? Tags drive which datafile each app loads.
2. **Environments?** Most projects ship one tree (environment can be an ordinary attribute). If development/staging/production need **independent definitions and datafiles**, use Sets — see [sets.md](references/sets.md) before committing to this.
3. **Where should events go → destinations?** Console only to start, or third-party vendors (GA4, Segment, Sentry, …), or a custom backend? This decides which modules the apps must install.
4. **What identifies a user?** `userId`, `deviceId`, or both — these become the first attributes and the recommended sampling identity.
5. **File format?** YAML (default) or JSON.

Then scaffold in an empty directory — ideally a **separate repo** from application code (review tracking changes like code, deploy datafiles independently — that separation is the point of the tool):

```bash
npx @eventvisor/cli init                 # minimal default scaffold (YAML)
npx @eventvisor/cli init --project=demo  # e-commerce reference: Targets, routing, transforms, effects, matrix tests
# other scaffolds: no-environments | environments (Sets) | test-environments | yml | json | monorepo
npm install
```

Pick the scaffold closest to their answers, then adjust `eventvisor.config.js` to match exactly. [templates/example-project/](templates/example-project/) is an alternative lint- and test-clean starting point.

### Existing project? Detect the setup before touching anything

**Always run these once at the start:**

```bash
npx eventvisor config
npx eventvisor list event --json
```

Config values that change the **shape of everything you write**:

- `sets` — if `true`, every entity path moves under `sets/<set>/…`, and you must author in the right set and scope commands with `--set`. Read [sets.md](references/sets.md) before doing anything in such a project.
- `parser` — if `"json"` author in JSON; otherwise YAML. Custom parsers exist too ([configuration.md](references/configuration.md)).
- `tags` — the allowlist for every entity's `tags:`; a tag not listed here fails lint.
- Directory-path overrides (`eventsDirectoryPath`, `schemasDirectoryPath`, etc.) — rare, but check.

Entity keys come from file paths: `events/page_view.yml` defines `page_view`, and nested directories namespace with `/` — `events/auth/signup.yml` defines `auth/signup`, `schemas/customer/address.yml` defines `customer/address`. Use the exact key everywhere: definitions, test specs, and `track()` calls in app code.

Then read one or two existing entities (an event, a destination) to match local style — indentation, quoting, comment density, key ordering — before adding new ones.

## When to load which reference

This file is loaded eagerly. The files below are loaded only when relevant — read them in full **before** authoring or debugging in that area, don't rely on the summary in this file.

| Task                                                                                                                                                                                   | Read                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Create or edit an event (schema, level, routing, sampling, validation)                                                                                                                 | [events.md](references/events.md)                         |
| Define or change an attribute (typed context, defaults, persistence)                                                                                                                   | [attributes.md](references/attributes.md)                 |
| Reusable `schemas/` and the JSON Schema subset (types, enum, required…)                                                                                                                | [schemas.md](references/schemas.md)                       |
| Create or edit a destination (transports, filtering, body shaping)                                                                                                                     | [destinations.md](references/destinations.md)             |
| Effects — triggered side-effects, state, steps, handlers, persistence                                                                                                                  | [effects.md](references/effects.md)                       |
| Write or change conditions; look up an operator                                                                                                                                        | [conditions.md](references/conditions.md)                 |
| Sources — `source` / `attribute` / `payload` / `state` / `lookup`                                                                                                                      | [sources.md](references/sources.md)                       |
| Transforms — set/remove/rename/concat/spread/append/to\* and friends                                                                                                                   | [transforms.md](references/transforms.md)                 |
| Sampling — percentages, ranges, bucket keys, conditional rules                                                                                                                         | [sampling.md](references/sampling.md)                     |
| Tags and Targets — scoping datafiles per app/surface                                                                                                                                   | [tags-targets.md](references/tags-targets.md)             |
| **Sets** — isolated projects in one repo; environments as Sets; monorepos                                                                                                              | [sets.md](references/sets.md)                             |
| `eventvisor.config.js`, parsers, directory overrides                                                                                                                                   | [configuration.md](references/configuration.md)           |
| Write a `.spec.yml` test, run `eventvisor test`                                                                                                                                        | [testing.md](references/testing.md)                       |
| Any CLI invocation, flags, entity types                                                                                                                                                | [cli.md](references/cli.md)                               |
| Answer "which events go where / who uses X / why was this dropped"; browse via Catalog                                                                                                 | [querying.md](references/querying.md)                     |
| Build datafiles, revisions, deploy to CDN, CI pipeline                                                                                                                                 | [building-datafiles.md](references/building-datafiles.md) |
| **Use the SDK in an app** — JS/TS, browser, Node.js, datafile refresh, diagnostics                                                                                                     | [sdk-javascript.md](references/sdk-javascript.md)         |
| React or React Native integration (`EventvisorProvider`, hooks)                                                                                                                        | [sdk-react.md](references/sdk-react.md)                   |
| Modules — official catalog (console, GA4, Segment, pixel…) and writing custom ones                                                                                                     | [modules.md](references/modules.md)                       |
| Code generation (typed TS `track`/`setAttribute` bindings)                                                                                                                             | [code-generation.md](references/code-generation.md)       |
| **Common patterns** — governance, routing, vendor migration, ingestion costs, validation rollout, deprecation, marketing pixels, error tracking, enrichment, microfrontends, ownership | [recipes.md](references/recipes.md)                       |
| Terminology refresher                                                                                                                                                                  | [glossary.md](references/glossary.md)                     |

Per-entity templates live in [templates/](templates/) — copy and adapt rather than writing from memory.

A **complete end-to-end mini project** lives in [templates/example-project/](templates/example-project/). It passes `lint` and `test` as-is — use it as the source of truth for "show me how a realistic Eventvisor project hangs together" requests.

## The pipeline: how a tracked event flows

Nearly every authoring question is really a question about where in this pipeline something happens. When `track(eventName, payload)` runs in an app, the SDK executes — in this order:

1. **Event lookup** — unknown event key → warning, dropped.
2. **`requiredAttributes`** — every listed attribute must currently be set, else dropped.
3. **Validation** against the original payload. Invalid events follow `drop`, `deliverWithWarning`, or quarantine policy.
4. **Event `conditions`** — no match → silently dropped.
5. **Event `sample`** — not in the sampled bucket → dropped.
6. **Event `transforms`** — reshape the payload once, for all destinations.
7. **Effects** with `on: event_tracked` run and finish.
8. **Per destination**, with all selected transports started in parallel:
   a. the destination's `transport` module must be installed in the app, else an error is logged and that destination is skipped;
   b. the event's per-destination override — `false` disables, or its own `conditions` / `sample` / `transforms`;
   c. the destination's own `conditions` → `sample` → `transforms`;
   d. the resulting body and datafile revision are handed to the transport.
9. The SDK emits its `event_tracked` event.

`track()` resolves to the transformed payload, or `null` when governance drops it. Core governs events; transports own queueing, retry, persistence, and delivery guarantees. `flush()` asks queueing modules to attempt buffered work.

Attributes have a shorter pipeline: `setAttribute` → validate against the attribute's schema (invalid → not set) → attribute `transforms` → stored → effects with `on: attribute_set` fire → persisted per `persist` strategy.

## Core authoring rules

These apply to every change. Internalize them; the references add depth, they do not override these.

### 1. Schemas are contracts with running applications

The definitions repo can deploy in minutes; application code ships on its own schedule. Any change that makes currently-tracked payloads invalid — adding a `required` property, narrowing a type or enum, adding `requiredAttributes` — causes live events to be **rejected and reach no destination** the moment the datafile lands. Sequence it: add the property as optional → update apps to send it → make it required. Same in reverse for removals: `deprecated: true` first (apps get console warnings but data still flows), clean up the app code, then archive or delete.

### 2. Sampling identity is an append-only decision

`sample.by` is what keeps sampling consistent for the same user across sessions, devices, and platforms. Pick a stable identity (`attributes.userId`, falling back via `or:` to `deviceId`) and don't change it casually — changing `by` re-buckets everyone, breaking longitudinal analysis. Raising a percentage keeps everyone already sampled; lowering it drops some of them. Ranges (`[0, 50]`) are start-inclusive, end-exclusive, and sampling **fails closed** when the bucket source resolves to nothing.

### 3. Module names in YAML must exist in the apps

`transport: ga4`, `lookup: localstorage.consent`, `handler: pixel`, `persist: localstorage` all reference **modules installed in the application at SDK init**. A definition referencing a module the app hasn't installed fails at runtime (destinations log "no transport" and deliver nothing). Roll out in order: app installs the module and deploys → then land the definition that uses it. When you add such a definition, remind the user which package the apps need (see [modules.md](references/modules.md)).

### 4. Don't reference entities that don't exist

Before writing `destinations: {ga4: …}` in an event, `requiredAttributes: [userId]`, `schema: identifier`, or an effect trigger on an event name — confirm the referenced entity exists (or create it). `npx eventvisor lint` catches dangling references, circular Schema references, tag violations, and per-type transform mistakes — but only if you run it.

### 5. After any edit, lint

```bash
npx eventvisor lint
```

If you wrote or changed a test spec, also run:

```bash
npx eventvisor test --keyPattern=<theKey>
```

## CLI: run freely

All `eventvisor` CLI commands are local and safe to run without confirmation, with one caveat: bare `build` writes `datafiles/` and increments the revision counter under `.eventvisor/` — harmless locally, but don't commit those outputs unless the project's convention does (check `.gitignore`; CI usually owns them). For pure inspection prefer `build --json`.

| Command                                                                       | Purpose                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npx eventvisor config`                                                       | Project configuration and resolved paths                                |
| `npx eventvisor lint`                                                         | Validate definitions (run after every edit)                             |
| `npx eventvisor list <entityType> [--keyPattern=…] [--json]`                  | List keys — event, attribute, destination, effect, schema, target, test |
| `npx eventvisor info <entityType> <key>`                                      | Show one definition                                                     |
| `npx eventvisor find-usage <entityType> <key>`                                | Where an attribute/schema/event/… is referenced                         |
| `npx eventvisor find-usage --unused-attributes --unused-schemas`              | Find dead definitions                                                   |
| `npx eventvisor simulate <event> --value='{…}' --attributes='{…}'`            | Run the full pipeline on a payload — the debugging tool                 |
| `npx eventvisor test [--keyPattern=…] [--assertionPattern=…]`                 | Run test specs                                                          |
| `npx eventvisor build [--tag=…] [--target=…]`                                 | Build datafiles                                                         |
| `npx eventvisor build --tag=<t> --json --pretty`                              | Print one datafile without side effects                                 |
| `npx eventvisor benchmark <event> -n 1000`                                    | Measure evaluation performance                                          |
| `npx eventvisor generate-code --language typescript --out-dir src/eventvisor` | Typed TS bindings                                                       |
| `npx eventvisor catalog`                                                      | Browsable UI of the whole project, live-reloading in watch mode         |
| `npx eventvisor promote --from dev --to staging`                              | Preview a Set promotion                                                 |

Add `--set=<set>` to any project command in a Sets project. Full reference in [cli.md](references/cli.md).

**Prefer the CLI over grepping** for questions like "which events use attribute X?", "what would happen if I tracked this payload?", or "which destinations would this event reach?". `simulate` and `find-usage` are authoritative; hand-tracing YAML is not.

## Changes ship through Git

Eventvisor is GitOps: nothing you write takes effect until it travels the pipeline —

**edit → PR review → merge → CI (lint, test, build) → datafiles uploaded to CDN → each app's next datafile fetch/refresh.**

Practical consequences:

- **Don't commit or push unless asked.** Editing files and running the CLI is your job; landing the change is the user's (or their CI's).
- Keep one logical change per branch/PR (a new event, a routing change, a sampling adjustment) — tracking changes get reviewed like code, often by data/analytics/compliance stakeholders via CODEOWNERS.
- Update or add the matching `.spec.yml` in the same change when behavior expectations shift.
- When the user asks **"when will this be live?"**, walk that pipeline: after merge, CI uploads datafiles, and each app picks the change up on its next fetch or `setDatafile()` refresh. Apps that bundle datafiles at build time only update when they redeploy — a reason to recommend CDN-served datafiles ([building-datafiles.md](references/building-datafiles.md)).

## Common authoring flows

### Starting a brand-new project

1. Run the setup interview from [Orient yourself first](#no-project-yet-interview-then-scaffold) — consumers/tags, environments, destinations, identity attributes, format.
2. Scaffold in an empty directory (a new repo, separate from app code) with the closest `init --project=…`, then `npm install`.
3. Adjust `eventvisor.config.js` until it matches the interview answers exactly (`tags`, `sets`, `parser`).
4. Replace the scaffolded entities with the user's first real attribute → event → destination, in that order (events and destinations reference attributes in conditions; destinations receive events), plus a Target per consuming app if they want dependency-aware datafiles.
5. `npx eventvisor lint && npx eventvisor test && npx eventvisor build` to prove the pipeline.
6. Offer the CI/CDN deployment setup from [building-datafiles.md](references/building-datafiles.md) when they're ready to ship — and `npx eventvisor catalog` so they can see what they built.

### Adding a new event

1. Read the existing `events/` directory to match conventions (file naming — `snake_case` vs `camelCase`, comment style).
2. Create `events/<key>.yml` from [templates/event.yml](templates/event.yml): description, tags, `type: object`, `properties`, `required`. Reuse `schemas/` definitions where the project has them.
3. If the event should reach only some destinations, add per-destination routing from [templates/event-with-routing.yml](templates/event-with-routing.yml).
4. Run `npx eventvisor lint`.
5. Offer (don't force): "I can add a `tests/events/<key>.spec.yml` covering this — want me to?" If yes, use [templates/test-event.spec.yml](templates/test-event.spec.yml).
6. Close the loop: tell the user what apps must do (`track("<key>", {…})`, and whether new attributes/modules are needed).

### Routing events to destinations

Default: every event goes to every destination in the datafile. Narrow it either from the destination side (destination `conditions` on `eventName` — good for "this vendor only gets these events") or the event side (`destinations:` overrides — good for "this event skips that vendor"). Read [destinations.md](references/destinations.md) and [events.md](references/events.md#destinations); the vendor-routing recipe is in [recipes.md](references/recipes.md#conditional-routing).

### Cutting ingestion costs (filtering + sampling)

Filtering (conditions) removes events entirely; sampling keeps a consistent percentage of users. Read [sampling.md](references/sampling.md), then apply at destination level by default, event level only for global cuts. State the expected data reduction when done.

### Migrating vendors

Add the new destination alongside the old, then shift traffic by complementary conditions or by sampling `range: [0, 50]` / `[50, 100]` splits — see [recipes.md](references/recipes.md#migrating-vendors). Remind the user the apps must install the new vendor's module first (rule 3).

### Marketing pixels / side-effects

Effects + the `pixel` handler module, with `state` + `conditions` to fire once and `persist` to survive reloads. Read [effects.md](references/effects.md); full pattern in [recipes.md](references/recipes.md#marketing-pixels-with-oversight).

### Debugging "where did my event go?"

Use `npx eventvisor simulate <event> --value='{…}' --attributes='{…}'` rather than reasoning by hand — it runs the real pipeline and shows the outcome. Walk the [pipeline](#the-pipeline-how-a-tracked-event-flows) top to bottom: unknown key? missing required attributes? validation failure? event conditions/sample? per-destination override? destination conditions/sample? missing transport module in the app? The last one is the classic silent killer — check the app's installed modules, not just the YAML. More in [querying.md](references/querying.md).

### Visual review with Catalog

`npx eventvisor catalog` serves a browsable UI of the whole project at `http://127.0.0.1:3000` **in watch mode** — it rebuilds and live-reloads the browser whenever definition files or the config change. Every event, attribute, Schema, destination, effect, and Target is shown with usage relationships, test cases (matrix-expanded), and Git history per entity. That makes it the ideal companion to an authoring session:

1. Start it once as a background process (it's local and read-only — safe to leave running).
2. If you have a browser tool, open `http://127.0.0.1:3000` in it; otherwise give the user the URL.
3. Author changes as usual — every edit shows up in the Catalog on save, so the user watches events, routing, and test coverage evolve visually while they prompt you.

Offer this proactively when a session involves several authoring changes or when the user is less comfortable reading YAML (PMs, marketers, analysts) — prompting plus a live Catalog is the best way to experience Eventvisor. Entity URLs are shareable. Details in [querying.md](references/querying.md).

### Recipes for higher-level use cases

When the request matches a named pattern — governance/single source of truth, conditional routing, vendor migration, saving ingestion costs, validation rollout, deprecation, filtering, data enrichment, marketing pixels, error tracking, microfrontends, environments, ownership/CODEOWNERS — open [recipes.md](references/recipes.md) and adapt the matching section. It links back to the granular references for shape details.

## Application integration (SDK + modules)

When the task is consuming Eventvisor from application code:

- **JavaScript / TypeScript / Node.js / browser** → read [sdk-javascript.md](references/sdk-javascript.md) in full. It covers install, `createEventvisor`, tracking, attributes, datafile refresh (merge vs replace), SDK events, diagnostics, `spawn()` child instances, and `close()`.
- **React / React Native** → [sdk-react.md](references/sdk-react.md) (`EventvisorProvider`, `useEventvisor`, `useEventvisorReady`).
- **Modules** → [modules.md](references/modules.md). The SDK core does nothing vendor-specific; every transport (console, GA4, GTM, Segment, Sentry, Datadog, Amplitude, Mixpanel, New Relic), lookup (localStorage, timestamp, UUID), handler (pixel), and storage layer is a module installed at init. Custom modules are ~10 lines.
- **Type-safe bindings** (generated `track`/`setAttribute` with compile-checked keys and payload types) → [code-generation.md](references/code-generation.md).

Key facts that prevent most integration mistakes: the app must load a **datafile** (built and deployed from the project repo) and decide its own refresh strategy; `track`/`setAttribute`/`setDatafile`/`close` are **async** and processed in call order, so await them when completion or a result matters; `track()` resolving to `null` means the pipeline dropped the event (see the pipeline above); event keys, property names, and attribute names must match the project's definitions exactly — verify against the project (or its Catalog) rather than guessing; `await eventvisor.onReady()` is only needed when persistence modules are in play.

## What not to do

- Do not make a schema stricter (new `required`, narrower enum, `requiredAttributes`) without warning that in-flight events from unupdated apps will be silently rejected — sequence loosen-first, tighten-later.
- Do not rename event keys or payload properties as cleanup — apps tracking the old shape break immediately; deprecate and migrate instead.
- Do not change `sample.by` or shrink percentages/ranges casually — that re-cohorts or drops live data.
- Do not reference transports, lookups, handlers, or storage names that no application module provides — coordinate app deployment first.
- Do not invent attribute, event, destination, or schema keys — in YAML or in application code. Verify they exist; create them explicitly if needed.
- Do not delete or archive entities before checking `find-usage`.
- Do not use `skipValidation` as a convenience — it exists for controlled cases (e.g. production-only bypass via conditions); validation is the governance value.
- Do not skip `npx eventvisor lint` after edits.
- Do not author project definitions inside an application repo — they belong in the Eventvisor project repo.
- Do not commit `datafiles/`, `out/`, or `.eventvisor/` changes unless the project's convention explicitly does.
