import type { DatafileContent, Test } from "@eventvisor/types";

import { executeTest } from "./executeTest";

describe("executeTest", () => {
  it("does not consider objects with different keys equal when their values are undefined", async () => {
    const datafile: DatafileContent = {
      schemaVersion: "1",
      revision: "1",
      attributes: {},
      events: { sample: { type: "object" } },
      destinations: {},
      effects: {},
    };
    const test: Test = {
      event: "sample",
      assertions: [
        {
          track: { actual: undefined },
          expectedEvent: { expected: undefined },
        },
      ],
    };

    const result = await executeTest({
      deps: { datasource: {} } as any,
      datafileContent: datafile,
      test,
      cliOptions: { quiet: true },
    });

    expect(result.passed).toBe(false);
    expect(result.assertions[0].errors?.[0]).toContain("expectedEvent");
  });
});
