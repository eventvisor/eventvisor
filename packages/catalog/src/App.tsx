import { Navigate, Route, Routes } from "react-router";
import type { CatalogManifest } from "./types";
import { CatalogProvider } from "./context/CatalogContext";
import { AppShell } from "./components/ui";
import { HomePage } from "./pages/HomePage";
import { ListPage } from "./pages/ListPage";
import { HistoryPage } from "./pages/HistoryPage";
import {
  DefinitionTab,
  EntityDetailPage,
  HistoryTab,
  OverviewTab,
  TestsTab,
  UsageTab,
} from "./pages/EntityDetailPage";
function EntityRoutes({ prefix = "" }: { prefix?: string } = {}) {
  return (
    <Route path={`${prefix}:entityPath/:entityKey`} element={<EntityDetailPage />}>
      <Route index element={<OverviewTab />} />
      <Route path="definition" element={<DefinitionTab />} />
      <Route path="tests" element={<TestsTab />} />
      <Route path="usage" element={<UsageTab />} />
      <Route path="history" element={<HistoryTab />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Route>
  );
}
export function App({ manifest }: { manifest: CatalogManifest }) {
  return (
    <CatalogProvider manifest={manifest}>
      <AppShell>
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="sets/:setKey" element={<Navigate to="events" replace />} />
          <Route path="sets/:setKey/history" element={<HistoryPage />} />
          <Route path="sets/:setKey/:entityPath" element={<ListPage />} />
          {EntityRoutes({ prefix: "sets/:setKey/" })}
          <Route path="history" element={<HistoryPage />} />
          <Route path=":entityPath" element={<ListPage />} />
          {EntityRoutes()}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </CatalogProvider>
  );
}
