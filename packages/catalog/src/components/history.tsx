import * as React from "react";
import { Link } from "react-router";
import { fetchHistoryPage } from "../api";
import { getEntityRoute } from "../entityTypes";
import type { HistoryPage } from "../types";
import { EmptyState } from "./ui";
import { useCatalog } from "../context/CatalogContext";

export function HistoryTimeline({ path, set }: { path: string; set?: string }) {
  const manifest = useCatalog();
  const [data, setData] = React.useState<HistoryPage>();
  const [page, setPage] = React.useState(1);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    setError("");
    fetchHistoryPage(path, page)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [path, page]);
  if (error) return <EmptyState title={error} />;
  if (!data) return <div className="py-12 text-center text-sm text-muted">Loading history…</div>;
  if (!data.entries.length) return <EmptyState title="No history is available." />;
  return (
    <div>
      <div className="divide-y divide-border">
        {data.entries.map((entry) => (
          <article key={`${entry.commit}-${entry.set || ""}`} className="py-5 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <a
                href={manifest.links?.commit?.replace(/{{(?:commit|hash)}}/, entry.commit)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm font-semibold text-primary"
              >
                {entry.commit.slice(0, 8)}
              </a>
              <time className="text-xs text-faint">
                {new Date(entry.timestamp).toLocaleString()}
              </time>
            </div>
            <p className="mt-1 text-sm text-muted">
              {entry.author}
              {entry.set ? ` · ${entry.set}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.entities.map((entity) => (
                <Link
                  key={`${entity.type}-${entity.key}-${entity.set || ""}`}
                  to={getEntityRoute(entity.type, entity.key, entity.set || set)}
                  className="rounded-full bg-pill px-2 py-1 font-mono text-xs text-primary hover:underline"
                >
                  {entity.type}: {entity.key}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
      {data.totalPages > 1 && (
        <div className="mt-6 flex justify-between">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="rounded border border-border px-3 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-muted">
            Page {page} of {data.totalPages}
          </span>
          <button
            disabled={page === data.totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded border border-border px-3 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
