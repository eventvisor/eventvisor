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

describe("Transformer types", () => {
  // initialize the dependencies
  const emitter = new Emitter();

  const logger = createLogger({ level: "fatal" });

  const datafileReader = new DatafileReader({
    datafile: {
      ...emptyDatafile,
      attributes: {
        ...emptyDatafile.attributes,
        browserName: {
          type: "string",
        },
        browserVersion: {
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

  /**
   * Increment
   */
  describe("increment", () => {
    it("increment without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            count: 1,
          },

          // transforms
          [
            {
              type: "increment",
              target: "count",
            },
          ],
        ),
      ).toEqual({
        count: 2,
      });
    });

    it("increment without target", async () => {
      expect(
        await transformer.applyAll(
          // value
          1,

          // transforms
          [
            {
              type: "increment",
            },
          ],
        ),
      ).toEqual(2);
    });

    it("increment by value", async () => {
      expect(
        await transformer.applyAll(
          // value
          1,

          // transforms
          [
            {
              type: "increment",
              value: 5,
            },
          ],
        ),
      ).toEqual(6);
    });
  });

  /**
   * Decrement
   */
  describe("decrement", () => {
    it("increment without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            count: 1,
          },

          // transforms
          [
            {
              type: "decrement",
              target: "count",
            },
          ],
        ),
      ).toEqual({
        count: 0,
      });
    });

    it("decrement without target", async () => {
      expect(
        await transformer.applyAll(
          // value
          1,

          // transforms
          [
            {
              type: "decrement",
            },
          ],
        ),
      ).toEqual(0);
    });

    it("decrement by value", async () => {
      expect(
        await transformer.applyAll(
          // value
          1,

          // transforms
          [
            {
              type: "decrement",
              value: 5,
            },
          ],
        ),
      ).toEqual(-4);
    });
  });

  /**
   * concat
   */
  describe("concat", () => {
    it("concat with payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "Bilbo",
            lastName: "Baggins",
          },

          // transforms
          [
            {
              type: "concat",
              payload: ["firstName", "lastName"],
              target: "fullName",
              separator: ";",
            },
            {
              type: "remove",
              target: "firstName",
            },
            {
              type: "remove",
              target: "lastName",
            },
          ],

          // inputs
          {
            payload: {
              firstName: "Bilbo",
              lastName: "Baggins",
            },
          },
        ),
      ).toEqual({
        fullName: "Bilbo;Baggins",
      });
    });
  });

  /**
   * remove
   */
  describe("remove", () => {
    it("remove properties", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "Bilbo",
            lastName: "Baggins",
          },

          // transforms
          [
            {
              type: "remove",
              target: "firstName",
            },
          ],
        ),
      ).toEqual({
        lastName: "Baggins",
      });
    });
  });

  /**
   * rename
   */
  describe("rename", () => {
    it("rename properties", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "Bilbo",
          },

          // transforms
          [
            {
              type: "rename",
              targetMap: {
                firstName: "name",
              },
            },
          ],
        ),
      ).toEqual({
        name: "Bilbo",
      });
    });

    it("rename nested properties", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            name: {
              firstName: "Bilbo",
              lastName: "Baggins",
            },
          },

          // transforms
          [
            {
              type: "rename",
              targetMap: {
                "name.firstName": "name.first_name",
                "name.lastName": "name.last_name",
              },
            },
          ],
        ),
      ).toEqual({
        name: {
          first_name: "Bilbo",
          last_name: "Baggins",
        },
      });
    });
  });

  /**
   * set
   */
  describe("set", () => {
    it("with payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "Bilbo",
          },

          // transforms
          [
            {
              type: "set",
              target: "lastName",
              value: "Baggins",
            },
          ],

          // inputs
          {
            payload: {
              firstName: "Bilbo",
            },
          },
        ),
      ).toEqual({
        firstName: "Bilbo",
        lastName: "Baggins",
      });
    });

    it("without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "Bilbo",
          },

          // transforms
          [
            {
              type: "set",
              target: "lastName",
              value: "Baggins",
            },
          ],
        ),
      ).toEqual({
        firstName: "Bilbo",
        lastName: "Baggins",
      });
    });

    it("without target", async () => {
      expect(
        await transformer.applyAll(
          // value
          {},

          // transforms
          [
            {
              type: "set",
              value: {
                firstName: "Bilbo",
                lastName: "Baggins",
              },
            },
          ],
        ),
      ).toEqual({
        firstName: "Bilbo",
        lastName: "Baggins",
      });
    });
  });

  /**
   * trim
   */
  describe("trim", () => {
    it("with payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "  John  ",
          },

          // transforms
          [
            {
              type: "trim",
              target: "firstName",
            },
          ],

          // inputs
          {
            payload: {
              firstName: "  John  ",
            },
          },
        ),
      ).toEqual({
        firstName: "John",
      });
    });

    it("without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "  John  ",
          },

          // transforms
          [
            {
              type: "trim",
              target: "firstName",
            },
          ],
        ),
      ).toEqual({
        firstName: "John",
      });
    });

    it("against multiple targets", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "  John  ",
            lastName: "  Doe  ",
          },

          // transforms
          [
            {
              type: "trim",
              target: "firstName",
            },
            {
              type: "trim",
              target: "lastName",
            },
          ],
        ),
      ).toEqual({
        firstName: "John",
        lastName: "Doe",
      });
    });
  });

  /**
   * toInteger
   */
  describe("toInteger", () => {
    it("with payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            age: "25",
          },

          // transforms
          [
            {
              type: "toInteger",
              target: "age",
            },
          ],

          // inputs
          {
            payload: {
              age: "25",
            },
          },
        ),
      ).toEqual({
        age: 25,
      });
    });

    it("without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            age: "25",
          },

          // transforms
          [
            {
              type: "toInteger",
              target: "age",
            },
          ],
        ),
      ).toEqual({
        age: 25,
      });
    });
  });

  /**
   * toDouble
   */
  describe("toDouble", () => {
    it("with payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            age: "25",
          },

          // transforms
          [
            {
              type: "toDouble",
              target: "age",
            },
          ],

          // inputs
          {
            payload: {
              age: "25",
            },
          },
        ),
      ).toEqual({
        age: 25.0,
      });
    });

    it("without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            age: "25",
          },

          // transforms
          [
            {
              type: "toDouble",
              target: "age",
            },
          ],
        ),
      ).toEqual({
        age: 25.0,
      });
    });
  });

  /**
   * toString
   */
  describe("toString", () => {
    it("with payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            age: 25,
          },

          // transforms
          [
            {
              type: "toString",
              target: "age",
            },
          ],
        ),
      ).toEqual({
        age: "25",
      });
    });

    it("without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            age: 25,
          },

          // transforms
          [
            {
              type: "toString",
              target: "age",
            },
          ],
        ),
      ).toEqual({
        age: "25",
      });
    });
  });

  /**
   * toBoolean
   */
  describe("toBoolean", () => {
    it("without payload", async () => {
      expect(
        await transformer.applyAll(
          // value
          {
            // true-ish
            a: 1,
            b: "true",
            c: "yes",
            d: "on",
            e: "y",
            f: "checked",
            g: true,

            // false-ish
            h: 0,
            i: "false",
            j: "no",
            k: "off",
            l: "n",
            m: "unchecked",
            n: false,
            o: "booyakasha!",
          },

          // transforms
          [
            {
              type: "toBoolean",
              target: "a",
            },
            {
              type: "toBoolean",
              target: "b",
            },
            {
              type: "toBoolean",
              target: "c",
            },
            {
              type: "toBoolean",
              target: "d",
            },
            {
              type: "toBoolean",
              target: "e",
            },
            {
              type: "toBoolean",
              target: "f",
            },
            {
              type: "toBoolean",
              target: "g",
            },
            {
              type: "toBoolean",
              target: "h",
            },
            {
              type: "toBoolean",
              target: "i",
            },
            {
              type: "toBoolean",
              target: "j",
            },
            {
              type: "toBoolean",
              target: "k",
            },
            {
              type: "toBoolean",
              target: "l",
            },
            {
              type: "toBoolean",
              target: "m",
            },
            {
              type: "toBoolean",
              target: "n",
            },
            {
              type: "toBoolean",
              target: "o",
            },
          ],
        ),
      ).toEqual({
        // true-ish
        a: true,
        b: true,
        c: true,
        d: true,
        e: true,
        f: true,
        g: true,

        // false-ish
        h: false,
        i: false,
        j: false,
        k: false,
        l: false,
        m: false,
        n: false,
        o: false,
      });
    });
  });

  /**
   * spread
   */
  describe("spread", () => {
    it("with inputs", async () => {
      await attributesManager.setAttribute("browserName", "Chrome");
      await attributesManager.setAttribute("browserVersion", "100");

      expect(
        await transformer.applyAll(
          // value
          {
            firstName: "Bilbo",
            lastName: "Baggins",
          },

          // transforms
          [
            {
              type: "set",
              value: {},
            },
            {
              source: "payload",
              type: "spread",
            },
            {
              source: "attributes",
              type: "spread",
            },
            {
              source: "eventName",
              type: "set",
              target: "event",
            },
          ],

          // inputs
          {
            eventName: "person",
            payload: {
              firstName: "Bilbo",
              lastName: "Baggins",
            },
          },
        ),
      ).toEqual({
        event: "person",

        firstName: "Bilbo",
        lastName: "Baggins",

        browserName: "Chrome",
        browserVersion: "100",
      });
    });
  });
});
