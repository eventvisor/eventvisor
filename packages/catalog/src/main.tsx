import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router";
import { fetchManifest } from "./api";
import { App } from "./App";
import "./styles.css";
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
const root = createRoot(rootElement);
fetchManifest()
  .then((manifest) => {
    const Router = manifest.router === "hash" ? HashRouter : BrowserRouter;
    const routerProps =
      manifest.router === "hash" || !manifest.basePath ? {} : { basename: manifest.basePath };
    root.render(
      <React.StrictMode>
        <Router {...routerProps}>
          <App manifest={manifest} />
        </Router>
      </React.StrictMode>,
    );
  })
  .catch((error: Error) => root.render(<div className="p-8 text-red-700">{error.message}</div>));
