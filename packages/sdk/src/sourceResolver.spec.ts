import { SourceResolver } from "./sourceResolver.js";
import { Emitter } from "./emitter.js";
import { createLogger } from "./logger.js";
import { ModulesManager } from "./modulesManager.js";
import { AttributesManager } from "./attributesManager.js";
import { EffectsManager } from "./effectsManager.js";
import { createTestDataProvider } from "./datafile.test-fixtures.js";
import { Validator } from "./validator.js";
import { ConditionsChecker } from "./conditions.js";
import { Transformer } from "./transformer.js";

describe("SourceResolver", () => {
  // initialize the dependencies
  const emitter = new Emitter();

  const logger = createLogger({ level: "fatal" });

  const datafileReader = createTestDataProvider({
    schemaVersion: "1",
    revision: "0",
    attributes: {
      attribute1: {
        type: "string",
      },
      attribute2: {
        type: "number",
      },
      attribute3: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
        },
      },
    },
    events: {},
    destinations: {},
    effects: {
      effect1: {
        on: {
          event_tracked: ["event1"],
        },
        state: {
          nested: {
            value: "effect1 value",
          },
        },
      },
      effect2: {
        on: {
          event_tracked: ["event2"],
        },
        state: 123,
      },
    },
  });

  const modulesManager = new ModulesManager({
    logger,
    getRevision: () => datafileReader.getRevision(),
    onDiagnostic: () => () => {},
    reportDiagnostic: () => {},
  });

  modulesManager.addModule({
    name: "module1",
    lookup: async ({ key }) => {
      if (!key) {
        return "module1 lookup value";
      }

      return `module1 lookup value: ${key}`;
    },
  });

  const validator = new Validator({
    logger,
    getSourceResolver: () => sourceResolver,
  });

  const attributesManager = new AttributesManager({
    logger,
    emitter,
    validator,
    getDataProvider: () => datafileReader,
    getTransformer: () => transformer,
    getConditionsChecker: () => conditionsChecker,
    modulesManager,
  });

  attributesManager.setAttribute("attribute1", "attribute1 value");
  attributesManager.setAttribute("attribute2", 200);
  attributesManager.setAttribute("attribute3", { name: "attribute3 value" });

  const effectsManager = new EffectsManager({
    logger,
    getDataProvider: () => datafileReader,
    getTransformer: () => transformer,
    getConditionsChecker: () => conditionsChecker,
    modulesManager: modulesManager,
  });

  const sourceResolver = new SourceResolver({
    logger,
    modulesManager,
    attributesManager,
    effectsManager,
  });

  const conditionsChecker = new ConditionsChecker({
    logger,
    getRegex: (regexString, regexFlags) => new RegExp(regexString, regexFlags),
    sourceResolver,
  });

  const transformer = new Transformer({
    logger,
    conditionsChecker,
    sourceResolver,
  });

  effectsManager.initialize();

  it("should resolve plain source from inputs", async () => {
    expect(
      await sourceResolver.resolve("payload.age", {
        payload: {
          age: 25,
        },
      }),
    ).toEqual(25);

    expect(
      await sourceResolver.resolve(
        {
          payload: "age",
        },
        {
          payload: {
            age: 25,
          },
        },
      ),
    ).toEqual(25);

    expect(
      await sourceResolver.resolve(
        {
          source: "payload.age",
        },
        {
          payload: {
            age: 25,
          },
        },
      ),
    ).toEqual(25);

    expect(
      await sourceResolver.resolve(
        {
          source: "payload.age",
        },
        {
          payload: {
            age: 25,
          },
        },
      ),
    ).toEqual(25);

    expect(
      await sourceResolver.resolve("payload.screen.width", {
        payload: {},
      }),
    ).toEqual(undefined);
  });

  it("should resolve attributes", async () => {
    // all attributes
    expect(await sourceResolver.resolve("attributes")).toEqual({
      attribute1: "attribute1 value",
      attribute2: 200,
      attribute3: {
        name: "attribute3 value",
      },
    });

    // direct source
    expect(await sourceResolver.resolve("attributes.attribute1")).toEqual("attribute1 value");
    expect(await sourceResolver.resolve("attributes.attribute2")).toEqual(200);
    expect(await sourceResolver.resolve("attributes.attribute3")).toEqual({
      name: "attribute3 value",
    });
    expect(await sourceResolver.resolve("attributes.attribute3.name")).toEqual("attribute3 value");
    expect(await sourceResolver.resolve("attributes.attribute4")).toEqual(null);

    // attribute
    expect(await sourceResolver.resolve({ attribute: "attribute1" })).toEqual("attribute1 value");
    expect(await sourceResolver.resolve({ attribute: "attribute2" })).toEqual(200);
    expect(await sourceResolver.resolve({ attribute: "attribute3" })).toEqual({
      name: "attribute3 value",
    });
    expect(await sourceResolver.resolve({ attribute: "attribute3.name" })).toEqual(
      "attribute3 value",
    );
    expect(await sourceResolver.resolve({ attribute: "attribute4" })).toEqual(null);
  });

  it("should resolve effect", async () => {
    // all effects
    expect(await sourceResolver.resolve("effects")).toEqual({
      effect1: {
        nested: {
          value: "effect1 value",
        },
      },
      effect2: 123,
    });

    // direct source
    expect(await sourceResolver.resolve("effects.effect1")).toEqual({
      nested: {
        value: "effect1 value",
      },
    });
    expect(await sourceResolver.resolve("effects.effect2")).toEqual(123);
    // expect(await sourceResolver.resolve("effects.effect3")).toEqual(null);

    // effect
    expect(await sourceResolver.resolve({ effect: "effect1" })).toEqual({
      nested: {
        value: "effect1 value",
      },
    });
    expect(await sourceResolver.resolve({ effect: "effect2" })).toEqual(123);
    // expect(await sourceResolver.resolve({ effect: "effect3" })).toEqual(null);
  });

  it("should resolve state when inside an effect", async () => {
    expect(
      await sourceResolver.resolve(
        { state: "counter" },
        {
          state: {
            counter: 10,
          },
        },
      ),
    ).toEqual(10);
  });

  it("should resolve lookup", async () => {
    expect(await sourceResolver.resolve({ lookup: "module1" })).toEqual("module1 lookup value");
    expect(await sourceResolver.resolve({ lookup: "module1.key" })).toEqual(
      "module1 lookup value: key",
    );
    expect(await sourceResolver.resolve({ lookup: "module1.key.subkey" })).toEqual(
      "module1 lookup value: key.subkey",
    );
  });
});
