import * as React from "react";
import { catalogAssetUrl } from "../api";
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
  getEntityRoute,
  sortSetKeys,
} from "../entityTypes";
import type { CatalogIndex, EntityPath } from "../types";
import type { DefinitionRow, SchemaRow } from "../definitionModel";
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
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={`rounded border border-border bg-elevated px-4 py-2 text-sm font-bold text-muted shadow-sm hover:bg-background ${className}`}
      {...rest}
    />
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
export function OverviewChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-text">
      {children}
    </span>
  );
}
export function OverviewMetaPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-elevated px-5 py-4">
      <dl className="space-y-3.5">{children}</dl>
    </div>
  );
}
export function OverviewMetaRow(props: { label: string; children?: React.ReactNode }) {
  if (!props.children) return null;
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-5">
      <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-faint sm:w-[4.75rem]">
        {props.label}
      </dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
        {props.children}
      </dd>
    </div>
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
function DefinitionValue({ value }: { value: unknown }) {
  if (typeof value === "string")
    return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</span>;
  if (value === undefined) return <span className="italic text-faint">undefined</span>;
  return (
    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{JSON.stringify(value)}</span>
  );
}
function DefinitionPath({ value }: { value: string }) {
  return (
    <>
      {value.split(/([.\]])/).map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {(part === "." || part === "]") && <wbr />}
        </React.Fragment>
      ))}
    </>
  );
}
export function FlatDefinitionTable({ rows }: { rows: DefinitionRow[] }) {
  if (!rows.length) return <EmptyState title="No additional configuration is defined." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead className="bg-elevated text-[10px] font-semibold uppercase tracking-wider text-faint">
          <tr>
            <th className="sticky left-0 z-10 w-[42%] bg-elevated px-3 py-2">Path</th>
            <th className="px-3 py-2">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.path} className="group align-top hover:bg-elevated/60">
              <th className="sticky left-0 bg-surface px-3 py-2 font-mono font-semibold text-text [overflow-wrap:anywhere] group-hover:bg-elevated">
                <DefinitionPath value={row.path} />
              </th>
              <td className="px-3 py-2 font-mono text-muted">
                <DefinitionValue value={row.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function SchemaTable({ rows, set }: { rows: SchemaRow[]; set?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="min-w-[48rem] w-full table-fixed border-collapse text-left text-xs">
        <thead className="bg-elevated text-[10px] font-semibold uppercase tracking-wider text-faint">
          <tr>
            <th className="sticky left-0 z-10 w-[25%] bg-elevated px-3 py-2">Path</th>
            <th className="w-[12%] px-3 py-2">Type</th>
            <th className="w-[11%] px-3 py-2 text-center">Required</th>
            <th className="w-[28%] px-3 py-2">Description</th>
            <th className="w-[24%] px-3 py-2">Constraints</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.path} className="group align-top hover:bg-elevated/60">
              <th className="sticky left-0 bg-surface px-3 py-2 font-mono font-semibold text-text group-hover:bg-elevated">
                <DefinitionPath value={row.path} />
              </th>
              <td className="px-3 py-2">
                {row.schemaKey ? (
                  <Link to={getEntityRoute("schema", row.schemaKey, set)}>
                    <Badge>{row.type}</Badge>
                  </Link>
                ) : (
                  <Badge>{row.type}</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                {row.required === true ? (
                  <span className="font-semibold text-text">Yes</span>
                ) : row.required === false ? (
                  <span className="text-faint">No</span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="px-3 py-2 leading-relaxed text-muted">
                {row.description || <span className="text-faint">—</span>}
              </td>
              <td className="px-3 py-2">
                {row.constraints.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {row.constraints.map((constraint) => (
                      <span
                        key={constraint.label}
                        className="inline-flex max-w-full gap-1 rounded bg-elevated px-1.5 py-0.5 text-[11px]"
                      >
                        <span className="font-semibold text-faint">{constraint.label}</span>
                        <span className="font-mono text-text [overflow-wrap:anywhere]">
                          <DefinitionValue value={constraint.value} />
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function PageHeader(props: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  titleAction?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 border-b border-border px-6 pb-4 pt-8 md:flex-row md:items-start">
      <div className="min-w-0 flex-1">
        <div className="group flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 text-3xl font-black text-text [overflow-wrap:anywhere]">
            {props.title}
          </h1>
          {props.titleAction}
        </div>
        {props.description && (
          <div className="mt-2 min-w-0 text-sm text-muted [overflow-wrap:anywhere]">
            {props.description}
          </div>
        )}
      </div>
      {props.actions && <div className="shrink-0">{props.actions}</div>}
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
  const selectId = React.useId();
  const selectRef = React.useRef<HTMLSelectElement>(null);
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
    <label
      htmlFor={selectId}
      className="relative inline-flex cursor-pointer items-center gap-2 rounded-lg bg-header-active px-3 py-1.5 text-sm font-semibold text-header-text"
      onClick={(event) => {
        if (event.target instanceof HTMLSelectElement) return;
        selectRef.current?.focus();
        selectRef.current?.showPicker?.();
      }}
    >
      <span className="text-xs font-black uppercase tracking-wide text-pill">Set</span>
      <select
        id={selectId}
        ref={selectRef}
        value={set || keys[0]}
        onChange={(e) => void switchSet(e.target.value)}
        className="max-w-44 appearance-none bg-transparent pr-7 font-black text-header-text outline-none"
        aria-label="Switch catalog set"
      >
        {keys.map((key) => (
          <option key={key}>{key}</option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-3 h-4 w-4 text-pill"
      >
        <path
          d="M6 8l4 4 4-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
  );
}
function formatGeneratedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function RepositoryIcon({ provider }: { provider?: string }) {
  const className = "h-5 w-5 shrink-0 fill-white/80 transition-colors group-hover:fill-white";
  if (provider === "github")
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 16 16">
        <path d="M8 0C3.58 0 0 3.69 0 8.24c0 3.64 2.29 6.72 5.47 7.81.4.08.55-.18.55-.4 0-.2-.01-.86-.01-1.56-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.15-.28-.16-.68-.55-.01-.56.63-.01 1.08.6 1.23.85.72 1.25 1.87.9 2.33.69.07-.54.28-.9.51-1.11-1.78-.21-3.64-.92-3.64-4.07 0-.9.31-1.64.82-2.22-.08-.21-.36-1.05.08-2.19 0 0 .67-.22 2.2.85A7.43 7.43 0 0 1 8 3.94c.68 0 1.36.09 2 .28 1.52-1.07 2.19-.85 2.19-.85.44 1.14.16 1.98.08 2.19.51.58.82 1.32.82 2.22 0 3.16-1.87 3.86-3.65 4.07.29.26.54.76.54 1.54 0 1.11-.01 2.01-.01 2.28 0 .22.15.48.55.4A8.13 8.13 0 0 0 16 8.24C16 3.69 12.42 0 8 0Z" />
      </svg>
    );
  if (provider === "gitlab")
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
        <path d="m22.75 9.77-.03-.08-2.17-6.69a.57.57 0 0 0-.55-.39.58.58 0 0 0-.52.35l-1.47 4.48H5.99L4.52 2.96A.58.58 0 0 0 4 2.61a.57.57 0 0 0-.55.39L1.28 9.69l-.03.08a1.54 1.54 0 0 0 .51 1.73l.01.01 10.22 7.43 10.24-7.44.01-.01a1.54 1.54 0 0 0 .51-1.72Z" />
      </svg>
    );
  if (provider === "bitbucket")
    return (
      <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
        <path d="M2.19 3.25a.77.77 0 0 0-.76.89l2.7 16.42a1.02 1.02 0 0 0 1 .86H18.9a1.02 1.02 0 0 0 1-.82l2.69-16.46a.77.77 0 0 0-.76-.89H2.19Zm13.36 10.71H9.46l-1.1-5.83h8.25l-1.06 5.83Z" />
      </svg>
    );
  return null;
}
function isKnownRepositoryProvider(provider?: string) {
  return provider === "github" || provider === "gitlab" || provider === "bitbucket";
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
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-3 py-3 sm:px-4">
          <Link
            to="/"
            className="flex min-w-0 max-w-full items-center gap-2.5 rounded-lg py-1 pr-2 outline-none ring-offset-2 ring-offset-header focus-visible:ring-2 focus-visible:ring-header-text"
            aria-label="Eventvisor Catalog home"
          >
            <img
              src={catalogAssetUrl("img/logo.png")}
              className="h-8 w-8 shrink-0 object-contain"
              alt=""
            />
            <img
              src={catalogAssetUrl("img/logo-text.png")}
              className="h-auto max-h-4 min-w-0 max-w-40 shrink object-contain object-left pl-2"
              alt=""
            />
          </Link>
          <div className="flex items-center gap-3">
            <SetSwitcher set={set} />
            {manifest.links?.repository && isKnownRepositoryProvider(manifest.links.provider) ? (
              <a
                href={manifest.links.repository}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex shrink-0"
                aria-label={`Open ${manifest.links.provider} repository`}
              >
                <RepositoryIcon provider={manifest.links.provider} />
              </a>
            ) : null}
          </div>
        </nav>
      </header>
      <main className="m-8 mx-auto max-w-5xl">
        <div className={sidebar ? "items-start gap-6 md:flex" : ""}>
          {sidebar && <Sidebar set={set} />}
          <div className={sidebar ? "min-w-0 flex-1" : "w-full"}>
            <section className="overflow-hidden rounded-lg bg-surface shadow">{children}</section>
            <footer className="mt-4 pt-3 text-center">
              <p className="pb-2 text-xs leading-5 text-faint">
                Generated at {formatGeneratedAt(manifest.generatedAt)}
              </p>
              <p className="pb-5 text-xs font-medium leading-5 text-muted">
                Built using{" "}
                <a href="https://eventvisor.org" className="font-semibold hover:underline">
                  Eventvisor
                </a>
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
