import type { Value } from "@eventvisor/types";
import { buildSelectedDatafile } from "../builder";
import type { BuildSelectedDatafileOptions } from "../builder";
import type { Plugin } from "../cli";
import { createCliInstance } from "../utils";
import { parseJsonOption } from "../utils";
import { getSelectedProjectExecution } from "../sets";
import { CLI_COLOR_CYAN, CLI_FORMAT_BOLD, CLI_FORMAT_GREEN, colorize } from "../tester/cliFormat";

export interface BenchmarkResult {
  iterations: number;
  minimum: number;
  average: number;
  maximum: number;
  p50: number;
  p95: number;
  p99: number;
  warmupIterations: number;
  unit: "microseconds";
}

export async function benchmarkEvent(
  instance: ReturnType<typeof createCliInstance>,
  event: string,
  value: Value,
  iterations: number,
): Promise<BenchmarkResult> {
  await instance.onReady();
  const warmupIterations = Math.min(1_000, Math.max(1, Math.ceil(iterations * 0.01)));
  for (let i = 0; i < warmupIterations; i++) await instance.track(event, value);

  let minimum = Infinity;
  let maximum = 0;
  let total = 0;
  const durations = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await instance.track(event, value);
    const elapsed = Number(process.hrtime.bigint() - start) / 1000;
    if (elapsed < minimum) minimum = elapsed;
    if (elapsed > maximum) maximum = elapsed;
    total += elapsed;
    durations[i] = elapsed;
  }
  durations.sort((left, right) => left - right);
  const percentile = (value: number) => durations[Math.ceil(value * durations.length) - 1];
  return {
    iterations,
    minimum,
    average: total / iterations,
    maximum,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    warmupIterations,
    unit: "microseconds",
  };
}

export const benchmarkPlugin: Plugin = {
  command: "benchmark <event>",
  description: "benchmark event evaluation",
  options: {
    n: { type: "number", description: "number of evaluations", alias: "iterations" },
    value: { type: "string", description: "event payload as JSON" },
    attributes: { type: "string", description: "attributes as JSON" },
    tag: { type: "array", description: "include one or more tags" },
    target: { type: "array", description: "include one or more Targets" },
    set: { type: "string", description: "select a project Set" },
    json: { type: "boolean", description: "print JSON output" },
  },
  handler: async ({ rootDirectoryPath, projectConfig, datasource, parsed }) => {
    const execution = await getSelectedProjectExecution(projectConfig, datasource, parsed.set);
    const deps = {
      rootDirectoryPath,
      projectConfig: execution.projectConfig,
      datasource: execution.datasource,
      options: parsed,
    };
    const instance = createCliInstance(
      await buildSelectedDatafile(deps, parsed as BuildSelectedDatafileOptions),
    );
    try {
      const value = parseJsonOption<Value>(parsed.value, {}, "Event value");
      const attributes = parseJsonOption<Record<string, Value>>(
        parsed.attributes,
        {},
        "Attributes",
      );
      if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
        throw new Error("Attributes must be a JSON object.");
      }
      for (const [name, attributeValue] of Object.entries(attributes)) {
        await instance.setAttribute(name, attributeValue);
      }
      const iterations = parsed.n ?? 1_000_000;
      if (!Number.isInteger(iterations) || iterations <= 0)
        throw new Error("Iterations must be a positive integer.");
      const result = await benchmarkEvent(instance, parsed.event, value, iterations);
      if (parsed.json) console.log(JSON.stringify(result));
      else {
        console.log("");
        console.log(CLI_FORMAT_BOLD, "Benchmarking Eventvisor event");
        console.log(`  ${colorize("Event", CLI_COLOR_CYAN)}:      ${parsed.event}`);
        console.log(`  ${colorize("Iterations", CLI_COLOR_CYAN)}: ${result.iterations}`);
        console.log(`  ${colorize("Warm-up", CLI_COLOR_CYAN)}:    ${result.warmupIterations}`);
        console.log("");
        console.log(CLI_FORMAT_GREEN, "Benchmark complete");
        console.log(
          `  ${colorize("Minimum duration", CLI_COLOR_CYAN)}: ${result.minimum.toFixed(3)} µs`,
        );
        console.log(
          `  ${colorize("Average duration", CLI_COLOR_CYAN)}: ${result.average.toFixed(3)} µs`,
        );
        console.log(
          `  ${colorize("Maximum duration", CLI_COLOR_CYAN)}: ${result.maximum.toFixed(3)} µs`,
        );
        console.log(
          `  ${colorize("p50 duration", CLI_COLOR_CYAN)}:     ${result.p50.toFixed(3)} µs`,
        );
        console.log(
          `  ${colorize("p95 duration", CLI_COLOR_CYAN)}:     ${result.p95.toFixed(3)} µs`,
        );
        console.log(
          `  ${colorize("p99 duration", CLI_COLOR_CYAN)}:     ${result.p99.toFixed(3)} µs`,
        );
        console.log("");
      }
    } finally {
      await instance.close();
    }
  },
  examples: [
    { command: "benchmark page_view -n 1000000", description: "benchmark event tracking" },
    {
      command: 'benchmark purchase -n 1000000 --attributes=\'{"userId":"123"}\'',
      description: "benchmark with attributes",
    },
  ],
};
