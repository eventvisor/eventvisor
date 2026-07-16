import type { HistoryEntry } from "@eventvisor/types";
import { Dependencies } from "../dependencies";

export async function generateHistory(deps: Dependencies): Promise<HistoryEntry[]> {
  const { datasource } = deps;

  try {
    const fullHistory = await datasource.listHistoryEntries();

    return fullHistory;
  } catch (error: any) {
    const details = error?.stderr?.toString?.() || error?.message || String(error);
    console.error(`Error when generating history from git: ${details}`);

    return [];
  }
}
