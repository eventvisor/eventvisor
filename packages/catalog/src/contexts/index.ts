import * as React from "react";
import { Catalog } from "@eventvisor/types";

export const CatalogContext = React.createContext<Catalog | undefined>(undefined);
