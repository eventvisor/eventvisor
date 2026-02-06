/**
 * JSON Schema (subset of it)
 */
export type PrimitiveValue = string | number | boolean | null | undefined;
export type ObjectValue = { [key: string]: Value };
export type Value = PrimitiveValue | ObjectValue | Value[];

export interface JSONSchema {
  // Basic metadata
  description?: string;

  // General validation keywords
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  enum?: Value[];
  const?: Value;

  // Numeric validation keywords
  maximum?: number;
  minimum?: number;

  // String validation keywords
  maxLength?: number;
  minLength?: number;
  pattern?: string;

  // Array validation keywords
  items?: JSONSchema | JSONSchema[];
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;

  // Object validation keywords
  required?: string[];
  properties?: { [key: string]: JSONSchema };

  // Annotations
  default?: Value;
  examples?: Value[];
}

/**
 * Common aliases
 */
export type Percentage = number; // 0 to 100 (up to 3 decimal places)

export type Tag = string;

export type Inputs = Record<string, Value>;

/**
 * Persist
 */
export type StorageName = string;

export type SimplePersist = StorageName;

export interface ComplexPersist {
  storage: StorageName;
  conditions?: Condition | Condition[];
}

export type Persist = SimplePersist | ComplexPersist | Persist[];

/**
 * Source
 */
export type Source = string;

export type SourceBase =
  // longer dotted path
  | { source: Source | Source[] }

  // more specific sources
  | { attribute: Source | Source[] } // can be dot-separated path
  | { state: Source | Source[] } // internally in Effect's own transforms
  | { effect: Source | Source[] }
  | { payload: Source | Source[] } // @TODO: or more specific eventValue and attributeValue?
  | { lookup: Source | Source[] };

/**
 * Conditions
 */
export type ConditionOperator =
  | "equals"
  | "notEquals"
  | "exists"
  | "notExists"

  // numeric
  | "greaterThan"
  | "greaterThanOrEquals"
  | "lessThan"
  | "lessThanOrEquals"

  // string
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"

  // semver (string)
  | "semverEquals"
  | "semverNotEquals"
  | "semverGreaterThan"
  | "semverGreaterThanOrEquals"
  | "semverLessThan"
  | "semverLessThanOrEquals"

  // date comparisons
  | "before"
  | "after"

  // array of strings
  | "includes"
  | "notIncludes"

  // regex
  | "matches"
  | "notMatches"

  // array of strings
  | "in"
  | "notIn";

export type PlainCondition = SourceBase & {
  operator: ConditionOperator;
  value?: Value;
  regexFlags?: string;
};

export interface AndCondition {
  and: Condition[];
}

export interface OrCondition {
  or: Condition[];
}

export interface NotCondition {
  not: Condition[];
}

export type Condition = PlainCondition | AndCondition | OrCondition | NotCondition | string;

/**
 * Sample
 */
export type SampleBySingle = Source | SourceBase;
export type SampleByMultiple = SampleBySingle[];
export interface SampleByOr {
  or: SampleByMultiple;
}
export type SampleBy = SampleBySingle | SampleByMultiple | SampleByOr;

export type SampleRange = [Percentage, Percentage];

export interface Sample {
  by: SampleBy;
  conditions?: Condition | Condition[];

  // either of them is required
  percentage?: Percentage;
  range?: SampleRange;
}

/**
 * Transforms
 */
export type TransformType =
  // mathematical
  | "increment"
  | "decrement"

  // manipulations
  | "concat" // @TODO: rename to `join`?
  | "remove"
  | "rename"
  | "set"
  | "trim"

  // to
  | "toInteger"
  | "toDouble"
  | "toString"
  | "toBoolean"

  // @TODO: consider later
  // | "uppercase"
  // | "lowercase"

  // complex
  | "spread"
  | "append";

export type Transform = Partial<SourceBase> & {
  type: TransformType;
  target?: string;
  targetMap?: Record<string, string> | Record<string, string>[];

  value?: Value;

  // additional params for certain transform types
  separator?: string;
  [key: string]: any;
};

/**
 * Attribute
 */
export type Attribute = JSONSchema & {
  archived?: boolean;
  deprecated?: boolean;
  description?: string;
  tags?: Tag[];

  transforms?: Transform[];
  persist?: Persist;
};

export type AttributeName = string;

/**
 * Event
 */
export type PlainDestinationOverride = boolean;

export interface ComplexDestinationOverride {
  conditions?: Condition | Condition[];
  sample?: Sample | Sample[];
  transforms?: Transform[];
}

export type DestinationOverride = PlainDestinationOverride | ComplexDestinationOverride;

export type EventLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

export type Event = JSONSchema & {
  archived?: boolean;
  deprecated?: boolean;
  description?: string;
  tags?: Tag[];

  // @TODO: meta

  level?: EventLevel;
  requiredAttributes?: string[];
  conditions?: Condition | Condition[];
  sample?: Sample | Sample[];
  transforms?: Transform[];
  destinations?: {
    [key: string]: DestinationOverride;
  };
};

export type EventName = string;

/**
 * Destination
 */
export interface Destination {
  archived?: boolean;
  description?: string;
  tags?: Tag[];

  transport: string;
  conditions?: Condition | Condition[];
  sample?: Sample | Sample[];
  transforms?: Transform[];
}

export type DestinationName = string;

/**
 * Effect
 */
export type EffectOnType = "event_tracked" | "attribute_set";
interface EffectOnRecord {
  event_tracked?: EventName[];
  attribute_set?: AttributeName[];
}
export type EffectOn = EffectOnType[] | EffectOnRecord;

export interface Step {
  description?: string;
  handler?: string;
  conditions?: Condition | Condition[];
  params?: Record<string, any>;
  transforms?: Transform[];
  continueOnError?: boolean;
}

export interface Effect {
  archived?: boolean;
  description?: string;
  tags?: Tag[];

  on?: EffectOn;
  state?: Value;
  conditions?: Condition | Condition[];
  steps?: Step[];
  persist?: Persist;
}

export type EffectName = string;

/**
 * Datafile
 */
export interface DatafileContent {
  schemaVersion: string;
  revision: string;
  attributes: {
    [key: AttributeName]: Attribute;
  };
  events: {
    [key: EventName]: Event;
  };
  destinations: {
    [key: DestinationName]: Destination;
  };
  effects: {
    [key: EffectName]: Effect;
  };
}

/**
 * Others
 */
export type EntityType = "attribute" | "event" | "destination" | "state" | "effect" | "test";

/**
 * Test
 */
export interface Action {
  type: "track" | "setAttribute" | "removeAttribute";
  name: EventName | AttributeName;
  value?: Value;
}

export type WithLookups = Record<string, Value>; // key is "<moduleName>.<additionalKey>"

// Attribute
export interface AttributeAssertion {
  description?: string;
  setAttribute?: Value;
  withLookups?: {
    [key: string]: Value;
  };

  expectedToBeValid?: boolean;
  expectedToBeSet?: boolean;
  expectedAttribute?: Value;
}

export interface AttributeTest {
  attribute: AttributeName;
  assertions: AttributeAssertion[];
}

// Event
export interface EventAssertion {
  description?: string;
  withAttributes?: {
    [key: AttributeName]: Value;
  };
  withLookups?: WithLookups;
  at?: Percentage; // @TODO: implement
  track?: Value;
  actions?: Action[];

  expectedToBeValid?: boolean;
  expectedToContinue?: boolean;
  expectedEvent?: Value;
  expectedDestinations?: DestinationName[];
  expectedDestinationsByTag?: Record<Tag, DestinationName[]>;
}

export interface EventTest {
  event: EventName;
  assertions: EventAssertion[];
}

// Effect
export interface EffectAssertion {
  description?: string;
  withAttributes?: {
    [key: AttributeName]: Value;
  };
  withLookups?: WithLookups;

  actions?: Action[];

  expectedState?: Value;
  expectedToBeHandled?: boolean;
  expectedToBeCalled?: {
    handler: string;
    times?: number;
  }[];
}

export interface EffectTest {
  effect: EffectName;
  assertions: EffectAssertion[];
}

// Destination
export interface DestinationAssertion {
  description?: string;
  withAttributes?: {
    [key: AttributeName]: Value;
  };
  withLookups?: {
    [key: string]: Value;
  };
  actions?: Action[];
  assertAfter?: number; // in ms

  expectedToBeTransported?: boolean;
  expectedBody?: Value;

  // @TODO: batch
  expectedBodies?: Value[];
  expectedToBeBatched?: boolean;
  expectedBatchedCount?: number;
}

export interface DestinationTest {
  destination: DestinationName;
  assertions: DestinationAssertion[];
}

// Combined
export type Test = EventTest | AttributeTest | EffectTest | DestinationTest;

export type TestName = string;

/**
 * Catalog
 */
export interface LastModified {
  commit: string;
  timestamp: string;
  author: string;
}

export interface Catalog {
  projectConfig: {
    tags: string[];
  };

  links?: {
    attribute: string;
    event: string;
    destination: string;
    effect: string;
    commit: string;
  };

  entities: {
    attributes: {
      [key: AttributeName]: Attribute & {
        lastModified?: LastModified;
      };
    };
    events: {
      [key: EventName]: Event & {
        lastModified?: LastModified;
      };
    };
    destinations: {
      [key: DestinationName]: Destination & {
        lastModified?: LastModified;
      };
    };
    effects: {
      [key: EffectName]: Effect & {
        lastModified?: LastModified;
      };
    };
  };
}

export interface HistoryEntity {
  type: EntityType;
  key: string;
}

export interface HistoryEntry {
  commit: string;
  author: string;
  timestamp: string;
  entities: HistoryEntity[];
}

export interface Commit {
  hash: string;
  author: string;
  timestamp: string;
  entities: EntityDiff[];
}

export interface EntityDiff {
  type: EntityType;
  key: string;
  created?: boolean;
  deleted?: boolean;
  updated?: boolean;
  content?: string;
}
