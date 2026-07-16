# Querying reference — answering questions about a project

Prefer CLI queries over grepping YAML: they resolve Sets, namespaced keys, Schema inlining, and dependency closures the way the build does.

## The common questions, mapped to commands

| Question                                              | Command                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| What events/attributes/destinations exist?            | `npx eventvisor list event` (`attribute`, `destination`, `effect`, `schema`, `target`, `test`) |
| Show me this definition                               | `npx eventvisor info event order_completed`                                                    |
| Where is attribute X used?                            | `npx eventvisor find-usage attribute userId`                                                   |
| Where is this Schema referenced?                      | `npx eventvisor find-usage schema identifier`                                                  |
| What references this event (effects, tests, targets)? | `npx eventvisor find-usage event page_view`                                                    |
| What would happen if an app tracked this?             | `npx eventvisor simulate <event> --value='{…}' --attributes='{…}'`                             |
| Which destinations would it reach?                    | `simulate` output, or write a quick event spec with `expectedDestinations`                     |
| What exactly is in the datafile app X loads?          | `npx eventvisor build --tag=<t> --json --pretty` or `--target=<t> --json --pretty`             |
| Is this change fast enough?                           | `npx eventvisor benchmark <event> -n 100000`                                                   |

Add `--json` to `list`/`config` for parseable output; add `--set` in Sets projects.

## Debugging "my event didn't arrive" — the checklist

Walk the pipeline in order, eliminating each stage:

1. **Key exists?** `npx eventvisor list event --keyPattern=<name>` — typos and namespacing (`auth/signup` vs `signup`) are common.
2. **In the app's datafile?** `npx eventvisor build --tag=<theAppsTag> --json | jq '.events | keys'` — wrong tags keep events out of that app's datafile entirely.
3. **Required attributes set?** Check the event's `requiredAttributes` against what the app sets before tracking.
4. **Valid payload?** `npx eventvisor simulate <event> --value='<the actual payload>' --attributes='<the actual attributes>'` — validation failures and their reasons show here.
5. **Event conditions / sample?** Same simulate run shows drops.
6. **Destination-side?** Check the event's `destinations:` overrides, then each destination's `conditions`/`sample`.
7. **Transport installed?** The one thing simulate can't see: does the running app actually register the module named in `transport:`? Look for "Destination has no transport" errors in the app's console/diagnostics ([sdk-javascript.md](sdk-javascript.md#diagnostics)).
8. **Datafile fresh?** `eventvisor.getRevision()` in the app vs the latest built revision — stale CDNs and bundled datafiles lag.

## Visual review with the Catalog

```bash
npx eventvisor catalog        # export + serve, prints a local URL
```

The Catalog is a browsable UI of the whole project: every entity with its definition, **usage relationships** (which events use this attribute, which Targets include this event), **Git history per entity** (who changed what, when), test specs with matrix cases expanded, and Schema pages showing shared structure + all referencing entities. Entity and assertion URLs are shareable; keys are URL-encoded so namespaced definitions remain addressable.

Offer it proactively when:

- a session involves several authoring changes (author → refresh → see the result),
- the user is less comfortable reading YAML (PMs, marketers, analysts),
- someone asks "what do we track, overall?" — the Catalog _is_ the tracking plan.

For deployment as a shared internal site: `catalog export --base-path /event-catalog` and serve `out/` statically (host must fall back to `index.html` for app routes, or use `--hash-router`). Sets projects get a set selector. `catalog serve` serves an existing export.

## Auditing and history

Everything is Git: `git log --follow events/order_completed.yml` answers who/when/why, and the Catalog's per-entity history shows the same visually. For org-wide review workflows (CODEOWNERS, branch protection), see [recipes.md](recipes.md#ownership).
