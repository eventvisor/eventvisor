import React from "react";
import { createRoot } from "react-dom/client";

import { Root } from "./blocks/root";

import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<Root />);
