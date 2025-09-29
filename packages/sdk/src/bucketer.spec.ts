import { Transformer } from "./transformer";
import { emptyDatafile, DatafileReader } from "./datafileReader";
import { createLogger } from "./logger";
import { ModulesManager } from "./modulesManager";
import { EffectsManager } from "./effectsManager";
import { AttributesManager } from "./attributesManager";
import { SourceResolver } from "./sourceResolver";
import { ConditionsChecker } from "./conditions";
import { Emitter } from "./emitter";
import { Validator } from "./validator";
import { Bucketer } from "./bucketer";

describe("Bucketer", () => {
  // initialize the dependencies
  const emitter = new Emitter();

  const logger = createLogger({ level: "fatal" });

  const datafileReader = new DatafileReader({
    datafile: {
      ...emptyDatafile,
      attributes: {
        ...emptyDatafile.attributes,
        userId: {
          type: "string",
        },
        deviceId: {
          type: "string",
        },
      },
    },
    logger,
  });

  const modulesManager = new ModulesManager({
    logger,
    getDatafileReader: () => datafileReader,
    getSourceResolver: () => sourceResolver,
  });

  const validator = new Validator({
    logger,
    getSourceResolver: () => sourceResolver,
  });

  const attributesManager = new AttributesManager({
    logger,
    emitter,
    validator,
    getDatafileReader: () => datafileReader,
    getTransformer: () => transformer,
    getConditionsChecker: () => conditionsChecker,
    modulesManager,
  });

  const effectsManager = new EffectsManager({
    logger,
    getDatafileReader: () => datafileReader,
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

  const bucketer = new Bucketer({
    logger,
    sourceResolver,
    conditionsChecker,
    transformer,
  });

  /**
   * Get bucket key
   */
  describe("getBucketKey", () => {
    it("should get bucket key: plain string", async () => {
      expect(
        await bucketer.getBucketKey(
          // sampleBy
          { source: "payload.age" },

          // inputs
          { payload: { age: 25 } },
        ),
      ).toEqual("25");
    });

    it("should get bucket key: multiple plain strings", async () => {
      expect(
        await bucketer.getBucketKey(
          // sampleBy
          [{ source: "payload.age" }, { source: "payload.name" }],

          // inputs
          { payload: { age: 25, name: "John" } },
        ),
      ).toEqual("25.John");
    });

    it("should get bucket key: from attributes", async () => {
      await attributesManager.setAttribute("userId", "user-123");
      await attributesManager.setAttribute("deviceId", "device-234");

      // single attribute
      expect(
        await bucketer.getBucketKey(
          // sampleBy
          { attribute: "userId" },

          // inputs
          {},
        ),
      ).toEqual("user-123");

      // multiple attributes
      expect(
        await bucketer.getBucketKey(
          // sampleBy
          [{ attribute: "userId" }, { attribute: "deviceId" }],

          // inputs
          {},
        ),
      ).toEqual("user-123.device-234");

      // or
      expect(
        await bucketer.getBucketKey(
          // sampleBy
          { or: [{ attribute: "userId" }, { attribute: "deviceId" }] },

          // inputs
          {},
        ),
      ).toEqual("user-123");
    });
  });
});
