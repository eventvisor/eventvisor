# Eventvisor skills

Agent skills for authoring, querying, and integrating [Eventvisor](https://eventvisor.org) — Git-based governance, transformation, filtering, and routing of analytics events and logs.

Installable via [`npx skills`](https://www.skills.sh):

```bash
# inside your Eventvisor project (or your app repo)
npx skills add eventvisor/eventvisor

# or pin to the path directly
npx skills add https://github.com/eventvisor/eventvisor/tree/main/skills/eventvisor
```

Then in your agent (Claude Code, Cursor, Codex, OpenCode, etc.) ask things like:

- "Define an `order_completed` event with an order ID, total, and item count"
- "Route all `page_view` events to GA4 and everything else to the console"
- "Sample the `search` event down to 10% of users to cut ingestion costs"
- "Why didn't my `checkout_started` event reach the warehouse destination?"
- "Migrate our events from the old vendor to Segment, 50% of users at a time"
- "Deprecate the `button_click` event so teams get warnings before we remove it"
- "Add a marketing pixel that fires once after the first `page_view`, with GDPR consent"
- "Set up a brand-new Eventvisor project for my team"
- "Wire Eventvisor tracking into my React app"
- "Which events use the `userId` attribute?"
- "Upgrade this project from Eventvisor 0.x to v1"

## What's included

A single skill, `eventvisor`, that the agent invokes (e.g. as `/eventvisor` in Claude Code) covering:

- **Authoring** — events (schemas, validation, levels, conditions, transforms, sampling, per-destination routing), attributes (typed context with defaults, transforms, persistence), reusable Schemas, destinations (transports, filtering, body shaping), effects (triggered side-effects with state, steps, handlers), tags, Targets (dependency-aware datafiles), and Sets (isolated projects / environments).
- **Testing** — declarative `.spec.yml` assertions for events, attributes, destinations, and effects; matrix expansion; simulated lookups; async destination assertions.
- **Querying** — `list`, `info`, `find-usage`, `simulate`, and `benchmark` recipes for answering questions about an existing project without grepping YAML.
- **Visual review** — pairs authoring with `npx eventvisor catalog` running locally in watch mode: the agent makes changes by prompt, and the Catalog in your (or the agent's) browser live-reloads so you see every entity, its history, usage relationships, tests, and Target membership evolve visually.
- **Application integration** — `@eventvisor/sdk` (browser and Node.js), `@eventvisor/react`, the Java SDK for JVM services, official modules (console, GA4, GTM, Segment, Sentry, Datadog, Amplitude, Mixpanel, New Relic, HTTP, Beacon, pixel, localStorage, timestamp, UUID), custom modules, and typed code generation.
- **Upgrading** — the 0.x to v1 path for both the project repo and each application, in the order that lets them ship separately.
- **Security** — what the datafile publishing path actually controls, why pixel script execution is off by default, and how to gate destinations on consent.
- **Templates** — copy-and-adapt YAML for every common authoring shape, plus a complete lint- and test-passing example project.

## Updating

```bash
npx skills update eventvisor
```

## Reporting issues

This skill lives in the main Eventvisor monorepo: <https://github.com/eventvisor/eventvisor/issues>
