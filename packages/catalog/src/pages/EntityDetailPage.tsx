import * as React from "react";
import { Link, Navigate, Outlet, useOutletContext, useParams } from "react-router";
import { fetchEntityDetail } from "../api";
import { decodeRouteSegment, entityLabels, entityPathToType, getEntityRoute } from "../entityTypes";
import type { CatalogEntityType, EntityDetail, EntityPath } from "../types";
import {
  Badge,
  DefinitionTree,
  EmptyState,
  EntityKey,
  LabelValueBadge,
  MarkdownContent,
  PageHeader,
  Tabs,
} from "../components/ui";
import { EntityTests } from "../components/tests";
import { HistoryTimeline } from "../components/history";

interface DetailContext {
  detail: EntityDetail;
  set?: string;
}
const validPaths: EntityPath[] = ["events", "attributes", "destinations", "effects", "targets"];
function CopyKey({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      title="Copy key"
      onClick={() =>
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        })
      }
      className="text-sm text-muted opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 focus:opacity-100"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
export function EntityDetailPage() {
  const { entityPath, entityKey, setKey } = useParams();
  const set = setKey ? decodeRouteSegment(setKey) : undefined;
  const key = decodeRouteSegment(entityKey || "");
  const [detail, setDetail] = React.useState<EntityDetail>();
  const [error, setError] = React.useState("");
  if (!validPaths.includes(entityPath as EntityPath)) return <Navigate to="/" replace />;
  const type = entityPathToType[entityPath as EntityPath];
  React.useEffect(() => {
    setDetail(undefined);
    setError("");
    fetchEntityDetail(type, key, set)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [type, key, set]);
  if (error)
    return (
      <>
        <PageHeader title={key} />
        <div className="px-6 pb-6">
          <EmptyState title={error} />
        </div>
      </>
    );
  if (!detail) return <div className="p-12 text-center text-sm text-muted">Loading…</div>;
  const tabs = [
    { to: ".", label: "Overview" },
    { to: "definition", label: "Definition" },
    { to: "tests", label: "Tests" },
    { to: "usage", label: "Usage" },
    { to: "history", label: "History" },
  ];
  return (
    <>
      <PageHeader
        title={<EntityKey value={key} />}
        titleAction={<CopyKey value={key} />}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <span>{entityLabels[type].singular}</span>
            {detail.entity.archived && <Badge tone="danger">archived</Badge>}
            {detail.entity.deprecated && <Badge tone="warning">deprecated</Badge>}
            {detail.entity.targets?.length ? (
              <LabelValueBadge label="Targets" value={detail.entity.targets.length} />
            ) : null}
          </div>
        }
        actions={
          detail.sourceUrl ? (
            <a
              href={detail.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded border border-border bg-elevated px-4 py-2 text-sm font-bold text-muted hover:bg-background"
            >
              View source
            </a>
          ) : null
        }
      />
      <Tabs items={tabs}>
        <Outlet context={{ detail, set } satisfies DetailContext} />
      </Tabs>
    </>
  );
}
export function OverviewTab() {
  const { detail } = useOutletContext<DetailContext>();
  const entity = detail.entity;
  const facts: Array<[string, unknown]> = [
    ["Type", entity.type],
    ["Level", entity.level],
    ["Transport", entity.transport],
    ["Persistence", entity.persistence],
    ["Validation", entity.validation],
    [
      "Last modified",
      detail.lastModified ? new Date(detail.lastModified.timestamp).toLocaleString() : undefined,
    ],
  ];
  return (
    <div className="space-y-7">
      <section>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
          Description
        </div>
        <MarkdownContent value={entity.description} />
      </section>
      <dl className="grid gap-5 sm:grid-cols-2">
        {facts
          .filter(([, value]) => value !== undefined)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase text-faint">{label}</dt>
              <dd className="mt-1 text-sm">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </dd>
            </div>
          ))}
      </dl>
      {entity.tags?.length ? (
        <section>
          <div className="mb-2 text-xs font-semibold uppercase text-faint">Tags</div>
          <div className="flex flex-wrap gap-2">
            {entity.tags.map((tag: string) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </section>
      ) : null}
      {entity.targets?.length ? (
        <section>
          <div className="mb-2 text-xs font-semibold uppercase text-faint">Targets</div>
          <div className="flex flex-wrap gap-2">
            {entity.targets.map((target: string) => (
              <Badge key={target}>{target}</Badge>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
export function DefinitionTab() {
  const { detail } = useOutletContext<DetailContext>();
  const definition = Object.fromEntries(
    Object.entries(detail.entity).filter(
      ([key]) => !["description", "lastModified", "targets"].includes(key),
    ),
  );
  return (
    <div>
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-faint">
        Complete definition
      </div>
      <DefinitionTree value={definition} />
    </div>
  );
}
export function TestsTab() {
  const { detail } = useOutletContext<DetailContext>();
  return <EntityTests tests={detail.tests} type={detail.type} />;
}
export function UsageTab() {
  const { detail, set } = useOutletContext<DetailContext>();
  const relationships = Object.entries(detail.relationships || {}).filter(
    ([, values]) => values.length,
  );
  if (!relationships.length)
    return <EmptyState title="This definition is not referenced by other definitions." />;
  return (
    <div className="space-y-7">
      {relationships.map(([collection, values]) => {
        const type = collection.replace(/s$/, "") as CatalogEntityType;
        return (
          <section key={collection}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
              {collection}
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {values.map((key) => (
                <Link
                  key={key}
                  to={getEntityRoute(type, key, set)}
                  className="block px-4 py-3 font-mono text-sm text-primary hover:bg-elevated"
                >
                  {key}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
export function HistoryTab() {
  const { detail, set } = useOutletContext<DetailContext>();
  return detail.historyPath ? (
    <HistoryTimeline path={detail.historyPath} set={set} />
  ) : (
    <EmptyState title="No history is available." />
  );
}
