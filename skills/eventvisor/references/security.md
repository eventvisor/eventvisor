# Security and privacy

Full docs: <https://eventvisor.org/docs/security>

Eventvisor moves tracking decisions out of application code and into a datafile that applications fetch at runtime. That is the whole value, and it is also the thing to be careful about: **whoever controls the datafile origin controls what every application collects, transforms, and sends, without shipping any code.** Raise this proactively when a user sets up publishing, adds a pixel, or asks about compliance.

## The publishing path is the trust boundary

- Serve datafiles over TLS from infrastructure the team controls.
- Require review on project changes and restrict who holds publishing credentials. This is the same argument as reviewing code, and it is why the project belongs in Git.
- Keep generated datafiles **public-safe**: no credentials, tokens, or personal data. They are fetched by browsers and are effectively public whatever the CDN settings say. If a destination needs a secret, the secret belongs in the transport module's application configuration, not in a definition.
- Retain revisions and keep a rollback path. Choose cache settings that let clients recover quickly from a bad publish ([building-datafiles.md](building-datafiles.md)).
- If the threat model calls for signed configuration, verify integrity in the application **before** calling `setDatafile()`. The SDK does not do this for you.

## Browser scripts are off by default

The [pixel handler module](modules.md) can turn remotely configured snippets into DOM content. **Script execution is disabled by default** and has to be enabled deliberately:

```js
createPixelModule({
  allowScripts: true,
  nonce: () => window.__cspNonce,
});
```

Only enable it in applications where the datafile origin is trusted and protected, and pair it with a restrictive Content Security Policy. The configured nonce replaces any nonce supplied by the snippet in the datafile, so the application keeps control. Treat compromise of the datafile origin as a potential application security incident, not just a data quality problem.

When a user asks for marketing pixels, say this once, plainly, then help them do it ([recipes.md](recipes.md)). The pattern is legitimate and common; the default being off is the point.

## What the runtime already refuses

Useful to know, because it explains lint and diagnostic failures that otherwise look arbitrary:

- Source and transform paths that could traverse object prototypes are rejected.
- Transformed transport payloads must stay JSON compatible. Functions, symbols, non-finite numbers, circular values, and anything else that cannot be transported safely are rejected with a diagnostic rather than silently mangled.
- HTTP and Beacon queues snapshot accepted payloads, so a later mutation in application code cannot change an event already waiting for delivery.
- Queue limits are finite by design. Choose them for the memory available on the target platform ([modules.md](modules.md)).

## Privacy sits with the destinations

Transport modules receive governed payloads and selected attributes. Eventvisor decides **what is allowed to leave**; it does not make a third-party destination compliant. When a user adds a destination, the questions worth asking are its endpoint, authentication, retention, regional routing, and privacy controls.

Two Eventvisor features do real work here, and are worth offering:

- **Consent gating.** A destination `conditions` block on a consent attribute means events never leave the device before consent is set. That is stronger than post-hoc deletion, and it is one line ([destinations.md](destinations.md)).
- **Minimisation at the edge.** Transforms can drop or redact properties per destination, so a vendor receives only what it needs while your own warehouse keeps the full payload ([transforms.md](transforms.md)).

Report vulnerabilities privately through GitHub Security Advisories rather than a public issue.
