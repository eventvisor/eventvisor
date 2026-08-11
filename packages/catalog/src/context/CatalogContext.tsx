import * as React from "react";
import type { CatalogManifest } from "../types";
const Context = React.createContext<CatalogManifest | null>(null);
export function CatalogProvider(props: { manifest: CatalogManifest; children: React.ReactNode }) {
  return <Context.Provider value={props.manifest}>{props.children}</Context.Provider>;
}
export function useCatalog() {
  const value = React.useContext(Context);
  if (!value) throw new Error("Catalog context is unavailable");
  return value;
}
