import type { Condition, DatafileContent, Event, Target, Test, Transform } from "./index";

const condition = {
  not: [{ or: [{ attribute: "country", operator: "equals", value: "NL" }] }],
} satisfies Condition;

const transform = {
  type: "append",
  target: "items",
  payload: ["current", "next"],
} satisfies Transform;

const event = {
  description: "Checkout",
  type: "object",
  requiredAttributes: ["userId"],
  conditions: condition,
  transforms: [transform],
} satisfies Event;

const target = {
  description: "Web checkout",
  tags: { and: ["web", "checkout"] },
  includeEvents: ["checkout.*"],
  excludeEffects: "internal.*",
} satisfies Target;

const test = {
  event: "checkout.started",
  assertions: [{ matrix: { country: ["NL", "DE"] }, track: { country: "{{country}}" } }],
} satisfies Test;

const datafile = {
  schemaVersion: "1",
  revision: "1",
  attributes: {},
  events: { checkout: event },
  destinations: {},
  effects: {},
} satisfies DatafileContent;

void [target, test, datafile];

// @ts-expect-error unsupported condition operators must fail at compile time
const invalidCondition: Condition = { attribute: "country", operator: "unknown" };
void invalidCondition;

// @ts-expect-error condition groups must not be empty
const emptyCondition: Condition = { and: [] };
void emptyCondition;

// @ts-expect-error test specs must contain an assertion
const emptyTest: Test = { event: "checkout.started", assertions: [] };
void emptyTest;

const emptyMatrix = {
  event: "checkout.started",
  assertions: [{ matrix: { country: [] } }],
} as const;
// @ts-expect-error matrix dimensions must contain a value
const invalidMatrixTest: Test = emptyMatrix;
void invalidMatrixTest;
