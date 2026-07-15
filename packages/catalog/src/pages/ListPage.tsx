import * as React from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { fetchIndex } from "../api";
import { decodeRouteSegment, entityLabels, entityPathToType, getEntityRoute } from "../entityTypes";
import type { CatalogIndex, EntityPath, EntitySummary } from "../types";
import { Badge, EmptyState, EntityKey, LabelValueBadge, PageHeader } from "../components/ui";

const paths: EntityPath[] = ["events", "attributes", "destinations", "effects", "targets"];
function meta(entity: EntitySummary, path: EntityPath) {
  if (path === "events")
    return [
      entity.level,
      entity.schemaType,
      entity.requiredAttributeCount ? `${entity.requiredAttributeCount} required` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  if (path === "attributes") return entity.schemaType;
  if (path === "destinations") return entity.transport;
  if (path === "effects")
    return entity.triggerCount ? `${entity.triggerCount} triggers` : undefined;
  if (path === "targets")
    return entity.selectionCount ? `${entity.selectionCount} filters` : undefined;
}
export function ListPage() {
  const { entityPath, setKey } = useParams();
  const set = setKey ? decodeRouteSegment(setKey) : undefined;
  const [index, setIndex] = React.useState<CatalogIndex>();
  const [error, setError] = React.useState("");
  const [search, setSearch] = useSearchParams();
  const query = search.get("q") || "";
  React.useEffect(() => {
    setIndex(undefined);
    setError("");
    fetchIndex(set)
      .then(setIndex)
      .catch((e: Error) => setError(e.message));
  }, [set]);
  if (!paths.includes(entityPath as EntityPath)) return <Navigate to="events" replace />;
  const path = entityPath as EntityPath;
  const type = entityPathToType[path];
  const entities = (index?.entities[type] || []).filter((entity) =>
    [entity.key, entity.description, ...(entity.tags || []), ...(entity.targets || [])]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title={entityLabels[type].plural}
        description={
          set ? `Definitions available in the ${set} Set` : "Definitions available in this project"
        }
      />
      <div className="px-6 pb-6">
        <input
          value={query}
          onChange={(e) => {
            const next = new URLSearchParams(search);
            e.target.value ? next.set("q", e.target.value) : next.delete("q");
            setSearch(next, { replace: true });
          }}
          placeholder={`Search ${entityLabels[type].plural.toLowerCase()}`}
          className="mb-5 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        {error ? (
          <EmptyState title={error} />
        ) : !index ? (
          <div className="py-12 text-center text-sm text-muted">Loading…</div>
        ) : !entities.length ? (
          <EmptyState
            title={
              query
                ? "No matching definitions."
                : `No ${entityLabels[type].plural.toLowerCase()} have been defined.`
            }
          />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {entities.map((entity) => (
              <Link
                key={entity.key}
                to={getEntityRoute(type, entity.key, set)}
                className="group block px-5 py-3 hover:bg-elevated"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                  <div className="flex min-h-6 items-center">
                    <EntityKey value={entity.key} className="text-sm font-semibold text-primary" />
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    {entity.archived && <Badge tone="danger">archived</Badge>}
                    {entity.deprecated && <Badge tone="warning">deprecated</Badge>}
                    {entity.targets?.length ? (
                      <LabelValueBadge label="Targets" value={entity.targets.length} />
                    ) : null}
                  </div>
                  <div className="min-w-0 truncate text-sm text-muted">
                    {entity.description || "No description"}
                  </div>
                  <div className="flex items-center gap-2 text-right text-[11px] text-faint">
                    {meta(entity, path)}
                    {entity.lastModified && (
                      <span>{new Date(entity.lastModified.timestamp).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-faint">
          {entities.length}{" "}
          {entities.length === 1
            ? entityLabels[type].singular.toLowerCase()
            : entityLabels[type].plural.toLowerCase()}
        </p>
      </div>
    </>
  );
}
