/**
 * JSON Schema (subset here)
 */
export type PrimitiveValue = string | number | boolean | null | undefined;
export type ObjectValue = { [key: string]: Value };
export type Value = PrimitiveValue | ObjectValue | Value[];

export interface JSONSchema {
  // Reference a reusable project Schema by key.
  schema?: SchemaKey;

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

export type SchemaKey = string;
export type Schema = JSONSchema;

/**
 * Common aliases
 */
export type Percentage = number; // 0 to 100 (up to 3 decimal places)

export type Tag = string;
export type NonEmptyArray<T> = [T, ...T[]];

export type TargetKey = string;
export type TargetPatterns = "*" | string | NonEmptyArray<string>;
export type TargetTags =
  | NonEmptyArray<Tag>
  | { or: NonEmptyArray<Tag> }
  | { and: NonEmptyArray<Tag> };

export interface Target {
  key?: TargetKey;
  description: string;
  tag?: Tag;
  tags?: TargetTags;
  includeEvents?: TargetPatterns;
  excludeEvents?: TargetPatterns;
  includeAttributes?: TargetPatterns;
  excludeAttributes?: TargetPatterns;
  includeDestinations?: TargetPatterns;
  excludeDestinations?: TargetPatterns;
  includeEffects?: TargetPatterns;
  excludeEffects?: TargetPatterns;
  pretty?: boolean;
  stringify?: boolean;
  revisionFromHash?: boolean;
}

export type Inputs = Record<string, Value>;

/**
 * Persist
 */
export type StorageName = string;

export type SimplePersist = StorageName;

export interface ComplexPersist {
  storage: StorageName;
  conditions?: Conditions;
}

export type Persist = SimplePersist | ComplexPersist | Persist[];

/**
 * Source
 */
export type Source = string;

export type SourceBase =
  // longer dotted path
  | { source: Source | NonEmptyArray<Source> }

  // more specific sources
  | { attribute: Source | NonEmptyArray<Source> } // can be dot-separated path
  | { state: Source | NonEmptyArray<Source> } // internally in Effect's own transforms
  | { effect: Source | NonEmptyArray<Source> }
  | { payload: Source | NonEmptyArray<Source> } // @TODO: or more specific eventValue and attributeValue?
  | { lookup: Source | NonEmptyArray<Source> };

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
  and: NonEmptyArray<Condition>;
}

export interface OrCondition {
  or: NonEmptyArray<Condition>;
}

export interface NotCondition {
  not: NonEmptyArray<Condition>;
}

export type Condition = PlainCondition | AndCondition | OrCondition | NotCondition | string;
export type Conditions = Condition | NonEmptyArray<Condition>;

/**
 * Sample
 */
export type SampleBySingle = Source | SourceBase;
export type SampleByMultiple = NonEmptyArray<SampleBySingle>;
export interface SampleByOr {
  or: SampleByMultiple;
}
export type SampleBy = SampleBySingle | SampleByMultiple | SampleByOr;

export type SampleRange = [Percentage, Percentage];

export interface Sample {
  by: SampleBy;
  conditions?: Conditions;

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

export interface TransformBase {
  source?: Source | NonEmptyArray<Source>;
  attribute?: Source | NonEmptyArray<Source>;
  state?: Source | NonEmptyArray<Source>;
  effect?: Source | NonEmptyArray<Source>;
  payload?: Source | NonEmptyArray<Source>;
  lookup?: Source | NonEmptyArray<Source>;
  conditions?: Conditions;
}

export type Transform = TransformBase & {
  type: TransformType;
  target?: string;
  targetMap?: Record<string, string> | Record<string, string>[];
  value?: Value;
  separator?: string;
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
  conditions?: Conditions;
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
  // @TODO: conitnueOnValidationFailure?: boolean;

  skipValidation?: boolean | { conditions: Conditions };
  level?: EventLevel;
  requiredAttributes?: string[];
  conditions?: Conditions;
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
  conditions?: Conditions;
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
  conditions?: Conditions;
  params?: Record<string, Value>;
  transforms?: Transform[];
  continueOnError?: boolean;
}

export interface Effect {
  archived?: boolean;
  description?: string;
  tags?: Tag[];

  on: EffectOn;
  state?: Value;
  conditions?: Conditions;
  steps?: Step[];
  persist?: Persist;
}

export type EffectName = string;

/**
 * Datafile
 */
export interface DatafileContent {
  schemaVersion: string;
  eventvisorVersion?: string;
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
export type EntityType =
  | "attribute"
  | "event"
  | "destination"
  | "state"
  | "effect"
  | "schema"
  | "target"
  | "test";

/**
 * Test
 */
export interface Action {
  type: "track" | "setAttribute" | "removeAttribute";
  name: EventName | AttributeName;
  value?: Value;
}

export type WithLookups = Record<string, Value>; // key is "<moduleName>.<additionalKey>"
export type AssertionMatrix = Record<string, NonEmptyArray<Value>>;

// Attribute
export interface AttributeAssertion {
  matrix?: AssertionMatrix;
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
  key?: string;
  attribute: AttributeName;
  assertions: NonEmptyArray<AttributeAssertion>;
}

// Event
export interface EventAssertion {
  matrix?: AssertionMatrix;
  description?: string;
  withAttributes?: {
    [key: AttributeName]: Value;
  };
  withLookups?: WithLookups;
  track?: Value;
  actions?: Action[];

  expectedToBeValid?: boolean;
  expectedEvent?: Value;
  expectedDestinations?: DestinationName[];
  expectedDestinationsByTag?: Record<Tag, DestinationName[]>;
}

export interface EventTest {
  key?: string;
  event: EventName;
  assertions: NonEmptyArray<EventAssertion>;
}

// Effect
export interface EffectAssertion {
  matrix?: AssertionMatrix;
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
  key?: string;
  effect: EffectName;
  assertions: NonEmptyArray<EffectAssertion>;
}

// Destination
export interface DestinationAssertion {
  matrix?: AssertionMatrix;
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

  expectedBodies?: Value[];
}

export interface DestinationTest {
  key?: string;
  destination: DestinationName;
  assertions: NonEmptyArray<DestinationAssertion>;
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
    sets: boolean;
    set?: string;
    availableSets?: string[];
  };

  links?: {
    attribute: string;
    event: string;
    destination: string;
    effect: string;
    schema: string;
    target: string;
    test: string;
    commit: string;
  };

  entities: {
    schemas: Record<SchemaKey, Schema & { lastModified?: LastModified; targets?: TargetKey[] }>;
    attributes: {
      [key: AttributeName]: Attribute & {
        lastModified?: LastModified;
        targets?: TargetKey[];
      };
    };
    events: {
      [key: EventName]: Event & {
        lastModified?: LastModified;
        targets?: TargetKey[];
      };
    };
    destinations: {
      [key: DestinationName]: Destination & {
        lastModified?: LastModified;
        targets?: TargetKey[];
      };
    };
    effects: {
      [key: EffectName]: Effect & {
        lastModified?: LastModified;
        targets?: TargetKey[];
      };
    };
    targets: Record<TargetKey, Target & { lastModified?: LastModified }>;
    tests: Record<TestName, Test>;
  };
  usages: Record<string, { type: EntityType; key: string }[]>;
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
