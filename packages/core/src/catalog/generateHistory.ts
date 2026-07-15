import type { HistoryEntry } from "@eventvisor/types";
import { Dependencies } from "../dependencies";

export async function generateHistory(deps: Dependencies): Promise<HistoryEntry[]> {
  const { datasource } = deps;

  try {
    const fullHistory = await datasource.listHistoryEntries();

    const filteredHistory = fullHistory
      .map((historyEntry) => {
        return {
          ...historyEntry,
          entities: historyEntry.entities.filter((entity) => {
            // ignore test specs
            return entity.type !== "test";
          }),
        };
      })
      .filter((historyEntry) => historyEntry.entities.length > 0);

    return filteredHistory;
  } catch (error: any) {
    const details = error?.stderr?.toString?.() || error?.message || String(error);
    console.error(`Error when generating history from git: ${details}`);

    return [];
  }
}
