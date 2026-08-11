import * as React from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";

import { fetchIndex } from "../api";
import { decodeRouteSegment, entityLabels, entityPathToType, getEntityRoute } from "../entityTypes";
import type { CatalogEntityType, CatalogIndex, EntityPath, EntitySummary } from "../types";
import { Badge, Button, EmptyState, EntityKey, PageHeader } from "../components/ui";
import { createQueryMatcher } from "../listSearch";

const LIST_PAGE_SIZE = 100;
const paths: EntityPath[] = [
  "events",
  "attributes",
  "destinations",
  "effects",
  "schemas",
  "targets",
];

function setSearchParam(params: URLSearchParams, key: string, value?: string) {
  const next = new URLSearchParams(params);
  value ? next.set(key, value) : next.delete(key);
  return next;
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function getHints(index: CatalogIndex, type: CatalogEntityType) {
  const entities = index.entities[type] || [];
  const tags = unique(entities.flatMap((entity) => entity.tags || []));
  const targets = unique(entities.flatMap((entity) => entity.targets || []));
  return [
    tags[0] ? `tag:${tags[0]}` : undefined,
    targets[0] ? `target:${targets[0]}` : undefined,
    entities.some((entity) => !entity.archived) ? "archived:false" : undefined,
    unique(entities.map((entity) => entity.schemaType))[0]
      ? `type:${unique(entities.map((entity) => entity.schemaType))[0]}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
}

function LastModified({ entity }: { entity: EntitySummary }) {
  if (!entity.lastModified) return <span>Last modified n/a</span>;
  const date = new Date(entity.lastModified.timestamp);
  const value = Number.isNaN(date.getTime())
    ? entity.lastModified.timestamp
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
  return (
    <span>
      Last modified by <span className="font-medium">{entity.lastModified.author}</span> on {value}
    </span>
  );
}

function RowMetadata({ entity, type }: { entity: EntitySummary; type: CatalogEntityType }) {
  const targets = unique(entity.targets || []);
  const facts = [
    type === "event" ? entity.level : undefined,
    type === "event" || type === "attribute" || type === "schema" ? entity.schemaType : undefined,
    type === "destination" ? entity.transport : undefined,
    type === "effect" && entity.triggerCount ? `${entity.triggerCount} triggers` : undefined,
    type === "target" && entity.selectionCount ? `${entity.selectionCount} filters` : undefined,
  ].filter((value): value is string => Boolean(value));
  if (!targets.length && !facts.length) return null;
  return (
    <div className="flex h-5 shrink-0 divide-x divide-border/70 overflow-hidden rounded-md border border-border/70 bg-surface text-[10px] text-faint">
      {facts.map((fact) => (
        <span key={fact} className="inline-flex items-center px-1.5 text-muted">
          {fact}
        </span>
      ))}
      {targets.length ? (
        <span
          title={`Targets: ${targets.join(", ")}`}
          className="inline-flex items-baseline gap-1 px-1.5"
        >
          <span>Targets</span>
          <strong className="tabular-nums text-muted">{targets.length}</strong>
        </span>
      ) : null}
    </div>
  );
}

function ListRow({
  entity,
  type,
  set,
}: {
  entity: EntitySummary;
  type: CatalogEntityType;
  set?: string;
}) {
  return (
    <Link
      to={getEntityRoute(type, entity.key, set)}
      className="group block px-6 py-3 hover:bg-elevated"
    >
      <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:grid-rows-[auto_auto]">
        <div className="flex min-h-6 min-w-0 items-center sm:col-start-1 sm:row-start-1">
          <EntityKey value={entity.key} className="text-sm font-semibold text-primary" />
        </div>
        <div className="flex min-h-6 min-w-0 flex-wrap items-center gap-2 sm:col-start-2 sm:row-start-1 sm:justify-end">
          {entity.archived ? <Badge tone="danger">archived</Badge> : null}
          {entity.deprecated ? <Badge tone="warning">deprecated</Badge> : null}
          <RowMetadata entity={entity} type={type} />
        </div>
        <div className="min-w-0 truncate text-sm text-muted sm:col-start-1 sm:row-start-2">
          {entity.description || "No description"}
        </div>
        <div className="flex min-w-0 items-center text-[11px] text-faint sm:col-start-2 sm:row-start-2 sm:justify-end sm:whitespace-nowrap sm:text-right">
          <LastModified entity={entity} />
        </div>
      </div>
    </Link>
  );
}

function SearchControls(props: {
  query: string;
  label: string;
  hints: string[];
  params: URLSearchParams;
  setParams: (params: URLSearchParams) => void;
}) {
  const [showHints, setShowHints] = React.useState(false);
  function toggleHint(hint: string) {
    const tokens = props.query.trim().split(/\s+/).filter(Boolean);
    const found = tokens.findIndex((token) => token.toLowerCase() === hint.toLowerCase());
    const next =
      found >= 0
        ? tokens.filter((_, index) => index !== found).join(" ")
        : [...tokens, hint].join(" ");
    props.setParams(setSearchParam(props.params, "q", next || undefined));
  }
  return (
    <div>
      <div className="relative">
        <input
          value={props.query}
          onChange={(event) =>
            props.setParams(setSearchParam(props.params, "q", event.target.value || undefined))
          }
          placeholder={`Search ${props.label.toLowerCase()}...`}
          className="w-full rounded-full border border-border bg-surface px-5 py-2 pr-10 text-xl text-text outline-none placeholder:text-faint focus:border-primary"
        />
        {props.hints.length ? (
          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            aria-label={showHints ? "Hide advanced search hints" : "Show advanced search hints"}
            className={`absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-black ${showHints ? "border-primary bg-primary text-header-text" : "border-border text-faint"}`}
          >
            ?
          </button>
        ) : null}
      </div>
      {showHints ? (
        <div className="flex flex-wrap items-center gap-2 pl-5 pt-2 text-xs text-muted">
          <span>Try:</span>
          {props.hints.map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => toggleHint(hint)}
              className="rounded bg-elevated px-1.5 py-0.5 font-mono hover:text-text"
            >
              {hint}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ListPage() {
  const { entityPath, setKey } = useParams();
  const set = setKey ? decodeRouteSegment(setKey) : undefined;
  const [params, setParams] = useSearchParams();
  const [index, setIndex] = React.useState<CatalogIndex>();
  const [error, setError] = React.useState("");
  const [visibleLimit, setVisibleLimit] = React.useState(LIST_PAGE_SIZE);
  const query = params.get("q") || "";
  const deferredQuery = React.useDeferredValue(query);
  const descending = params.get("sort") === "-name";
  const validPath = paths.includes(entityPath as EntityPath);
  const type = validPath ? entityPathToType[entityPath as EntityPath] : "event";

  React.useEffect(() => {
    setIndex(undefined);
    setError("");
    fetchIndex(set)
      .then(setIndex)
      .catch((reason: Error) => setError(reason.message));
  }, [set]);
  React.useEffect(() => setVisibleLimit(LIST_PAGE_SIZE), [query, descending, entityPath, set]);

  const filtered = React.useMemo(() => {
    if (!index) return [];
    const matches = createQueryMatcher(deferredQuery);
    return index.entities[type]
      .filter(matches)
      .slice()
      .sort((left, right) => (descending ? -1 : 1) * left.key.localeCompare(right.key));
  }, [deferredQuery, descending, index, type]);
  const hints = React.useMemo(() => (index ? getHints(index, type) : []), [index, type]);
  const visible = filtered.slice(0, visibleLimit);

  if (!validPath) return <Navigate to="events" replace />;
  if (error) return <EmptyState title="Unable to load catalog index" description={error} />;
  if (!index)
    return (
      <div className="px-6 py-8 text-muted">
        Loading {entityLabels[type].plural.toLowerCase()}...
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHeader title={entityLabels[type].plural} />
      <div className="px-6 pt-1">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <SearchControls
            query={query}
            label={entityLabels[type].plural}
            hints={hints}
            params={params}
            setParams={setParams}
          />
          <button
            type="button"
            className="inline-flex h-[46px] w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted"
            onClick={() =>
              setParams(setSearchParam(params, "sort", descending ? undefined : "-name"))
            }
          >
            <span>Sort</span>
            <strong className="text-text">{descending ? "Z-A" : "A-Z"}</strong>
          </button>
        </div>
      </div>
      {!filtered.length ? <EmptyState title="No results found" /> : null}
      <div className="divide-y divide-border bg-surface">
        {visible.map((entity) => (
          <ListRow key={entity.key} entity={entity} type={type} set={set} />
        ))}
      </div>
      <div className="space-y-4 px-6 pb-6 text-center">
        {visible.length < filtered.length ? (
          <Button onClick={() => setVisibleLimit((limit) => limit + LIST_PAGE_SIZE)}>
            Show {Math.min(LIST_PAGE_SIZE, filtered.length - visible.length)} more
          </Button>
        ) : null}
        <p className="text-sm text-muted">
          Showing {visible.length} of {filtered.length} {entityLabels[type].plural.toLowerCase()}
        </p>
      </div>
    </div>
  );
}
