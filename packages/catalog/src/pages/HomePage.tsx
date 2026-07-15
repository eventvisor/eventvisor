import { Navigate } from "react-router";
import { useCatalog } from "../context/CatalogContext";
import { encodeRouteSegment, sortSetKeys } from "../entityTypes";
export function HomePage() {
  const manifest = useCatalog();
  if (!manifest.sets) return <Navigate to="/events" replace />;
  const set = sortSetKeys(manifest.setKeys)[0];
  return <Navigate to={set ? `/sets/${encodeRouteSegment(set)}/events` : "/events"} replace />;
}
