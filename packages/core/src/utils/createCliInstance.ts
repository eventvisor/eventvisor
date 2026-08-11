import type { DatafileContent } from "@eventvisor/types";
import { createEventvisor } from "@eventvisor/sdk";
import type { EventvisorModule } from "@eventvisor/sdk";

export function createCliInstance(datafile: DatafileContent) {
  const names = new Set<string>();
  Object.values(datafile.destinations).forEach((destination) => names.add(destination.transport));
  Object.values(datafile.effects).forEach((effect) => {
    effect.steps?.forEach((step) => {
      if (step.handler) names.add(step.handler);
    });
  });

  const modules: EventvisorModule[] = Array.from(names).map((name) => ({
    name,
    transport: async () => undefined,
    handle: async () => undefined,
  }));
  return createEventvisor({ datafile, modules, logLevel: "fatal" });
}
