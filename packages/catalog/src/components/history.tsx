import * as React from "react";
import { Link } from "react-router";
import { fetchHistoryPage } from "../api";
import { entityLabels, getEntityRoute } from "../entityTypes";
import type { HistoryEntry, HistoryPage } from "../types";
import { Button, EmptyState, EntityKey } from "./ui";
import { useCatalog } from "../context/CatalogContext";
import {
  HISTORY_VISIBLE_ENTITY_LIMIT,
  formatHistoryTimestamp,
  getHistoryCommitUrl,
} from "../historyModel";

function CommitDate(props: { entry: HistoryEntry; commitUrl?: string }) {
  const label = formatHistoryTimestamp(props.entry.timestamp);
  return props.commitUrl ? (
    <a
      className="text-primary hover:underline"
      href={props.commitUrl}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  ) : (
    <span className="text-muted">{label}</span>
  );
}

function ProjectHistoryEntry(props: { entry: HistoryEntry; set?: string; commitUrl?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasMore = props.entry.entities.length > HISTORY_VISIBLE_ENTITY_LIMIT;
  const visibleEntities = expanded
    ? props.entry.entities
    : props.entry.entities.slice(0, HISTORY_VISIBLE_ENTITY_LIMIT);

  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-sm ring-1 ring-black/5">
      <div className="text-sm">
        <span className="font-semibold text-text">{props.entry.author}</span>{" "}
        <CommitDate entry={props.entry} commitUrl={props.commitUrl} />
      </div>
      {props.entry.set ? (
        <div className="mt-1 text-xs text-faint">Set: {props.entry.set}</div>
      ) : null}
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted">
        {visibleEntities.map((entity) => (
          <li
            key={`${entity.type}-${entity.key}-${entity.set || ""}`}
            className="[overflow-wrap:anywhere]"
          >
            {entityLabels[entity.type].singular}{" "}
            <Link
              className="font-medium text-primary hover:underline"
              to={getEntityRoute(entity.type, entity.key, entity.set || props.set)}
            >
              <EntityKey value={entity.key} className="font-medium" />
            </Link>
            {entity.set && entity.set !== props.entry.set ? (
              <span className="text-faint"> in {entity.set}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 text-sm font-semibold text-primary hover:underline"
        >
          {expanded
            ? "See less"
            : `See more (${props.entry.entities.length - HISTORY_VISIBLE_ENTITY_LIMIT} more)`}
        </button>
      ) : null}
    </li>
  );
}

function EntityHistoryEntry(props: { entry: HistoryEntry; commitUrl?: string }) {
  const content = (
    <>
      <div className="font-mono text-sm text-text">{props.entry.commit.slice(0, 10)}</div>
      <div className="mt-1 text-sm text-muted">
        {props.entry.author} · {formatHistoryTimestamp(props.entry.timestamp)}
      </div>
    </>
  );
  const className =
    "block rounded-lg border border-border bg-surface p-4 shadow-sm ring-1 ring-black/5";

  return props.commitUrl ? (
    <a
      href={props.commitUrl}
      target="_blank"
      rel="noreferrer"
      className={`${className} hover:bg-elevated`}
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function HistoryTimeline({
  path,
  set,
  compact = false,
}: {
  path: string;
  set?: string;
  compact?: boolean;
}) {
  const manifest = useCatalog();
  const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
  const [page, setPage] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const requestId = React.useRef(0);

  async function loadPage(nextPage: number, append: boolean) {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    try {
      const response: HistoryPage = await fetchHistoryPage(path, nextPage);
      if (requestId.current !== currentRequestId) return;
      setEntries((current) => (append ? [...current, ...response.entries] : response.entries));
      setPage(response.page);
      setTotalPages(response.totalPages);
    } catch (cause) {
      if (requestId.current !== currentRequestId) return;
      setError((cause as Error).message);
    } finally {
      if (requestId.current === currentRequestId) setLoading(false);
    }
  }

  React.useEffect(() => {
    setEntries([]);
    setPage(0);
    setTotalPages(1);
    setError("");
    void loadPage(1, false);
    return () => {
      requestId.current += 1;
    };
  }, [path]);

  if (error) return <EmptyState title="History unavailable" description={error} />;
  if (!entries.length && loading)
    return <div className="py-12 text-center text-sm text-muted">Loading history…</div>;
  if (!entries.length) return <EmptyState title="No history found" />;

  return (
    <div className="space-y-4">
      {compact ? (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntityHistoryEntry
              key={`${entry.commit}-${entry.timestamp}`}
              entry={entry}
              commitUrl={getHistoryCommitUrl(manifest.links?.commit, entry.commit)}
            />
          ))}
        </div>
      ) : (
        <ol className="space-y-4">
          {entries.map((entry) => (
            <ProjectHistoryEntry
              key={`${entry.commit}-${entry.timestamp}-${entry.set || ""}`}
              entry={entry}
              set={set}
              commitUrl={getHistoryCommitUrl(manifest.links?.commit, entry.commit)}
            />
          ))}
        </ol>
      )}
      {page < totalPages ? (
        <Button
          disabled={loading}
          onClick={() => void loadPage(page + 1, true)}
          className="w-full disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
