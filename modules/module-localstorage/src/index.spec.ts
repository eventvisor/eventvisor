import { createLocalStorageModule } from "./index";

describe("createLocalStorageModule", () => {
  it("reads, writes and removes namespaced values while keeping lookups direct", async () => {
    const values = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    };
    const module = createLocalStorageModule({ prefix: "ev:" });
    await module.writeToStorage!({ key: "state", value: false }, {} as any);
    expect(await module.readFromStorage!({ key: "state" }, {} as any)).toBe(false);
    values.set("lookup", "plain");
    expect(await module.lookup!({ key: "lookup" }, {} as any)).toBe("plain");
    await module.removeFromStorage!({ key: "state" }, {} as any);
    expect(values.has("ev:state")).toBe(false);
    delete (globalThis as any).window;
  });
});
