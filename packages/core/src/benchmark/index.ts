import type { Value } from "@eventvisor/types";
import { buildDatafile } from "../builder";
import type { BuildDatafileOptions } from "../builder";
import type { Plugin } from "../cli";
import { createCliInstance } from "../utils";
import { getSelectedProjectExecution } from "../sets";

export interface BenchmarkResult {
  iterations: number;
  minimum: number;
  average: number;
  maximum: number;
  unit: "microseconds";
}

export async function benchmarkEvent(
  instance,
  event: string,
  value: Value,
  iterations: number,
): Promise<BenchmarkResult> {
  let minimum = Infinity;
  let maximum = 0;
  let total = 0;
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await instance.track(event, value);
    const elapsed = Number(process.hrtime.bigint() - start) / 1000;
    if (elapsed < minimum) minimum = elapsed;
    if (elapsed > maximum) maximum = elapsed;
    total += elapsed;
  }
  return { iterations, minimum, average: total / iterations, maximum, unit: "microseconds" };
}

export const benchmarkPlugin: Plugin = {
  command: "benchmark <event>",
  options: {
    n: { type: "number", description: "number of evaluations", alias: "iterations" },
    value: { type: "string", description: "event payload as JSON" },
    tag: { type: "string" },
    target: { type: "string" },
    set: { type: "string" },
    json: { type: "boolean" },
  },
  handler: async ({ rootDirectoryPath, projectConfig, datasource, parsed }) => {
    const execution = await getSelectedProjectExecution(projectConfig, datasource, parsed.set);
    const deps = {
      rootDirectoryPath,
      projectConfig: execution.projectConfig,
      datasource: execution.datasource,
      options: parsed,
    };
    const instance = createCliInstance(await buildDatafile(deps, parsed as BuildDatafileOptions));
    try {
      const value = parsed.value ? JSON.parse(parsed.value) : {};
      const iterations = parsed.n ?? 1_000_000;
      if (!Number.isInteger(iterations) || iterations <= 0)
        throw new Error("Iterations must be a positive integer.");
      const result = await benchmarkEvent(instance, parsed.event, value, iterations);
      if (parsed.json) console.log(JSON.stringify(result));
      else {
        console.log(`Iterations: ${result.iterations}`);
        console.log(`Minimum:    ${result.minimum.toFixed(3)} µs`);
        console.log(`Average:    ${result.average.toFixed(3)} µs`);
        console.log(`Maximum:    ${result.maximum.toFixed(3)} µs`);
      }
    } finally {
      await instance.close();
    }
  },
  examples: [
    { command: "benchmark page_view -n 1000000", description: "benchmark event tracking" },
  ],
};
