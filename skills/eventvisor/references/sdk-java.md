# Java SDK reference

Full docs: <https://eventvisor.org/docs/sdks/java> and <https://github.com/eventvisor/eventvisor-java>

The Java SDK consumes the **same datafiles** as the JavaScript SDK and mirrors its runtime contract, so an event governed one way in the browser is governed the same way on the JVM. It is the right answer for backend services, and it also works from Kotlin and Android through normal JVM interoperability.

Read [sdk-javascript.md](sdk-javascript.md) for the concepts. Everything there transfers: the [pipeline](../SKILL.md#the-pipeline-how-a-tracked-event-flows), attributes, modules, diagnostics, merge-by-default datafiles, and asynchronous operations. Only the syntax differs.

## Creating an instance

```java
import org.eventvisor.sdk.Eventvisor;
import org.eventvisor.sdk.EventvisorOptions;

Eventvisor eventvisor = Eventvisor.createEventvisor(
    new EventvisorOptions().datafile(datafileJson)
);

eventvisor.onReady().join();
```

The options builder takes the datafile as a JSON string. Create **one instance per service** and share it, exactly as in JavaScript.

## Attributes and events

```java
eventvisor.setAttribute("userId", "user-123").join();
eventvisor.setAttribute("country", "NL").join();

Object tracked = eventvisor.track(
    "order_completed",
    Map.of("orderId", "order-1", "total", 49.95)
).join();
```

State changing operations return futures and are processed in call order. `track` resolves to the transformed event, or `null` when the pipeline rejected it. A `null` is governance doing its job, not an exception.

## Modules and diagnostics

```java
Eventvisor eventvisor = Eventvisor.createEventvisor(
    new EventvisorOptions()
        .datafile(datafileJson)
        .addModule(analyticsModule)
        .onDiagnostic(diagnostic -> report(
            diagnostic.getCode(),
            diagnostic.getDetails()
        ))
);
```

Implement `EventvisorModule` to supply lookups, effect handlers, transports, persistence, flushing, and cleanup. Modules receive `EventvisorModuleApi`, which exposes the current revision, diagnostics, and cycle-safe nested tracking.

Diagnostics use the **same stable codes** as the JavaScript SDK ([sdk-javascript.md](sdk-javascript.md#diagnostics)), so one alerting rule can cover a polyglot fleet. They never interrupt SDK behaviour. Error and fatal diagnostics also emit the `ERROR` SDK event.

## Datafiles and lifecycle

```java
eventvisor.setDatafile(nextDatafile).join();        // merges
eventvisor.setDatafile(nextDatafile, true).join();  // replaces

eventvisor.flush().join();
eventvisor.close().join();
```

Removing a module flushes it before closing it. Closing the instance flushes transports, closes modules, and removes event and diagnostic subscriptions. In a server process, close on shutdown so buffered events get a delivery attempt.

## What to remember when a project serves both runtimes

- The **project definitions are shared**, so a schema tightening or a new `requiredAttributes` entry hits the Java services and the browser at the same moment the datafile lands. Sequence those changes for the slowest deploying consumer.
- **Transports are per application.** A destination whose `transport` module exists in the browser bundle but not in the Java service will silently deliver nothing there, and only a diagnostic will say so. Give each runtime its own [Target](tags-targets.md) when their destination sets genuinely differ, rather than shipping definitions that one side cannot satisfy.
- Portable [conditions](conditions.md) exist precisely because of this: the regex subset and the ISO 8601 date requirement are what keep JavaScript and Java agreeing on the same datafile.

Installation details and the complete API live in the repository, which is the source of truth for the Java surface: <https://github.com/eventvisor/eventvisor-java>.
