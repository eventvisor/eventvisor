import { Transformer } from "./transformer";
import { emptyDatafile } from "./datafile";
import { createTestDataProvider } from "./datafile.test-fixtures";
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

  const datafileReader = createTestDataProvider({
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
  });

  const modulesManager = new ModulesManager({
    logger,
    getRevision: () => datafileReader.getRevision(),
    onDiagnostic: () => () => {},
    reportDiagnostic: () => {},
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

  const bucketer = new Bucketer({
    logger,
    sourceResolver,
    conditionsChecker,
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

  describe("isSampled", () => {
    it("uses the first matching sample in authored order", async () => {
      const result = await bucketer.isSampled(
        [
          {
            by: { payload: "id" },
            conditions: { payload: "kind", operator: "equals", value: "web" },
            percentage: 0,
          },
          { by: { payload: "id" }, percentage: 100 },
        ],
        { payload: { id: "123", kind: "web" } },
      );
      expect(result.matchedSample?.percentage).toBe(0);
      expect(result.isSampled).toBe(false);
    });

    it("treats percentages and ranges as precise 0 to 100 thresholds", async () => {
      expect(
        (
          await bucketer.isSampled(
            { by: { payload: "id" }, percentage: 0 },
            { payload: { id: "a" } },
          )
        ).isSampled,
      ).toBe(false);
      expect(
        (
          await bucketer.isSampled(
            { by: { payload: "id" }, percentage: 100 },
            { payload: { id: "a" } },
          )
        ).isSampled,
      ).toBe(true);
      expect(
        (
          await bucketer.isSampled(
            { by: { payload: "id" }, range: [0, 100] },
            { payload: { id: "a" } },
          )
        ).isSampled,
      ).toBe(true);
      expect(
        (
          await bucketer.isSampled(
            { by: { payload: "id" }, range: [0, 0] },
            { payload: { id: "a" } },
          )
        ).isSampled,
      ).toBe(false);
    });

    it("does not sample when no bucket source resolves", async () => {
      const result = await bucketer.isSampled(
        { by: { payload: "missing" }, percentage: 100 },
        { payload: {} },
      );
      expect(result).toMatchObject({ isSampled: false, bucketKey: "" });
    });

    it("falls through when no conditional sample matches", async () => {
      const result = await bucketer.isSampled(
        {
          by: "id",
          conditions: { payload: "kind", operator: "equals", value: "mobile" },
          percentage: 0,
        },
        { payload: { kind: "web" } },
      );
      expect(result).toEqual({ isSampled: true });
    });
  });
});
