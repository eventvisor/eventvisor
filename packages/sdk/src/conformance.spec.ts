import * as fs from "fs";
import * as path from "path";
import type { Conditions, JSONSchema, Value } from "@eventvisor/types";
import { getBucketedNumber } from "./bucketer.js";
import { createEventvisor } from "./index.js";
import { validate } from "./validator.js";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../../conformance/sdk-v1.json"), "utf8"),
);

describe("SDK v1 conformance", () => {
  it.each(fixture.bucketing.vectors)("preserves bucket vector $key", ({ key, bucket }) => {
    expect(getBucketedNumber(key)).toBe(bucket);
  });

  it.each(fixture.conditions)(
    "preserves condition case $name",
    async ({ conditions, payload, matches }) => {
      const instance = createEventvisor({
        datafile: {
          schemaVersion: "1",
          revision: "fixture",
          attributes: {},
          destinations: {},
          effects: {},
          events: { fixture: { skipValidation: true, conditions: conditions as Conditions } },
        },
        logLevel: "fatal",
      });
      const result = await instance.track("fixture", payload);
      expect(result !== null).toBe(matches);
      await instance.close();
    },
  );

  it.each(fixture.validation)(
    "preserves validation case $name",
    async ({ schema, value, valid }) => {
      await expect(validate(schema as JSONSchema, value as Value, {})).resolves.toEqual(
        expect.objectContaining({ valid }),
      );
    },
  );
});
