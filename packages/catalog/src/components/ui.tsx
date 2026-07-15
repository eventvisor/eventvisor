import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { fetchIndex } from "../api";
import {
  decodeRouteSegment,
  encodeRouteSegment,
  entityLabels,
  entityPaths,
  entityPathToType,
  getBasePath,
  sortSetKeys,
} from "../entityTypes";
import type { CatalogIndex, EntityPath } from "../types";
import { useCatalog } from "../context/CatalogContext";

export function Badge(props: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const tone = {
    neutral: "bg-pill border-border",
    warning: "bg-warning-surface border-orange-200",
    danger: "bg-danger-surface border-red-200 text-danger",
    success: "bg-success-surface border-green-200",
  }[props.tone || "neutral"];
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {props.children}
    </span>
  );
}
export function LabelValueBadge(props: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 overflow-hidden rounded-md border border-border/70 text-[10px]">
      <span className="flex items-center bg-elevated px-1.5 text-muted">{props.label}</span>
      <span className="flex items-center bg-surface px-1.5 font-medium text-text">
        {props.value}
      </span>
    </span>
  );
}
export function EntityKey(props: { value: string; className?: string }) {
  return (
    <span className={`[overflow-wrap:anywhere] ${props.className || ""}`}>
      {props.value.split(/([./])/).map((part, index) =>
        part === "." || part === "/" ? (
          <React.Fragment key={index}>
            {part}
            <wbr />
          </React.Fragment>
        ) : (
          part
        ),
      )}
    </span>
  );
}
export function EmptyState(props: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-border bg-elevated px-6 py-10 text-center">
      <p className="text-sm text-muted">{props.title}</p>
      {props.description && <p className="mt-2 text-sm text-faint">{props.description}</p>}
    </div>
  );
}
export function MarkdownContent(props: { value?: unknown }) {
  return typeof props.value === "string" && props.value.trim() ? (
    <div className="prose prose-sm prose-slate max-w-none">
      <ReactMarkdown>{props.value}</ReactMarkdown>
    </div>
  ) : (
    <span className="text-muted">n/a</span>
  );
}
export function DefinitionTree({ value }: { value: unknown }) {
  if (value === null || typeof value !== "object")
    return <span className="font-mono text-xs break-all">{JSON.stringify(value)}</span>;
  if (Array.isArray(value))
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <DefinitionTree key={index} value={item} />
        ))}
      </div>
    );
  return (
    <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {Object.entries(value as Record<string, unknown>).map(([key, child]) => (
        <div key={key} className="grid gap-2 px-3 py-2 sm:grid-cols-[10rem_1fr]">
          <dt className="font-mono text-xs font-semibold text-muted">{key}</dt>
          <dd className="min-w-0 text-sm">
            <DefinitionTree value={child} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function PageHeader(props: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  titleAction?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 border-b border-border px-6 pb-4 pt-8 md:flex-row">
      <div className="min-w-0">
        <div className="group flex items-center gap-2">
          <h1 className="min-w-0 text-3xl font-black text-text">{props.title}</h1>
          {props.titleAction}
        </div>
        {props.description && <div className="mt-2 text-sm text-muted">{props.description}</div>}
      </div>
      {props.actions && <div>{props.actions}</div>}
    </header>
  );
}
export function Tabs(props: { items: { to: string; label: string }[]; children: React.ReactNode }) {
  return (
    <>
      <nav className="flex overflow-x-auto border-b border-border">
        {props.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "."}
            className={({ isActive }) =>
              `min-w-24 border-b-2 px-3 pb-4 pt-2 text-center text-sm font-medium ${isActive ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-6 py-6">{props.children}</div>
    </>
  );
}

function Sidebar({ set }: { set?: string }) {
  const [index, setIndex] = React.useState<CatalogIndex>();
  React.useEffect(() => {
    fetchIndex(set)
      .then(setIndex)
      .catch(() => setIndex(undefined));
  }, [set]);
  const base = getBasePath(set);
  return (
    <aside className="rounded-lg bg-surface p-4 shadow-md ring-1 ring-black/5 md:w-56">
      <div className="mb-3 px-3 text-xs font-black uppercase tracking-wide text-muted">
        {set ? "Set" : "Project"}
      </div>
      <nav className="space-y-1">
        {entityPaths.map((path) => {
          const type = entityPathToType[path];
          return (
            <NavLink
              key={path}
              to={`${base}/${path}`}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${isActive ? "bg-header-active text-header-text" : "text-muted hover:bg-elevated hover:text-text"}`
              }
            >
              <span>{entityLabels[type].plural}</span>
              <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-black text-header">
                {index?.counts[type] ?? "-"}
              </span>
            </NavLink>
          );
        })}
        <NavLink
          to={`${base}/history`}
          className={({ isActive }) =>
            `block rounded-lg px-3 py-2 text-sm font-bold ${isActive ? "bg-header-active text-header-text" : "text-muted hover:bg-elevated"}`
          }
        >
          History
        </NavLink>
      </nav>
    </aside>
  );
}
function SetSwitcher({ set }: { set?: string }) {
  const manifest = useCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const keys = sortSetKeys(manifest.setKeys);
  if (!manifest.sets) return null;
  async function switchSet(nextSet: string) {
    const base = `/sets/${encodeRouteSegment(nextSet)}`;
    const match = location.pathname.match(/^\/sets\/[^/]+\/([^/]+)(?:\/([^/]+))?(\/.*)?$/);
    if (!match || !entityPaths.includes(match[1] as EntityPath)) return navigate(`${base}/events`);
    const entityPath = match[1] as EntityPath;
    const routeKey = match[2];
    const suffix = match[3] || "";
    if (!routeKey) return navigate(`${base}/${entityPath}`);
    const key = decodeRouteSegment(routeKey);
    try {
      const index = await fetchIndex(nextSet);
      const type = entityPathToType[entityPath];
      if (index.entities[type].some((entity) => entity.key === key))
        return navigate(`${base}/${entityPath}/${encodeRouteSegment(key)}${suffix}`);
    } catch {
      /* fall through to the list */
    }
    navigate(`${base}/${entityPath}`);
  }
  return (
    <label className="inline-flex items-center gap-2 rounded-lg bg-header-active px-3 py-1.5 text-sm text-header-text">
      <span className="text-xs font-black uppercase text-pill">Set</span>
      <select
        value={set || keys[0]}
        onChange={(e) => void switchSet(e.target.value)}
        className="bg-transparent font-black outline-none"
      >
        {keys.map((key) => (
          <option key={key}>{key}</option>
        ))}
      </select>
    </label>
  );
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const manifest = useCatalog();
  const location = useLocation();
  const match = location.pathname.match(/^\/sets\/([^/]+)/);
  const set = match ? decodeRouteSegment(match[1]) : undefined;
  const sidebar = !manifest.sets || Boolean(set);
  return (
    <div className="min-h-screen bg-background text-text">
      <header className="bg-header">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/img/logo.png" className="h-8 w-8 shrink-0 object-contain" alt="" />
            <img
              src="/img/logo-text.png"
              className="max-h-5 max-w-40 object-contain object-left"
              alt="Eventvisor"
            />
          </Link>
          <SetSwitcher set={set} />
        </nav>
      </header>
      <main className="mx-auto my-8 max-w-5xl px-4">
        <div className={sidebar ? "items-start gap-6 md:flex" : ""}>
          {sidebar && <Sidebar set={set} />}
          <div className={sidebar ? "mt-6 min-w-0 flex-1 md:mt-0" : "w-full"}>
            <section className="overflow-hidden rounded-lg bg-surface shadow">{children}</section>
            <footer className="py-6 text-center text-xs text-faint">
              Generated {new Date(manifest.generatedAt).toLocaleString()} · Built with{" "}
              <a href="https://eventvisor.com" className="font-semibold hover:underline">
                Eventvisor
              </a>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
