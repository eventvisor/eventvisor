import * as React from "react";
import { Link, Navigate, Outlet, useOutletContext, useParams } from "react-router";
import { fetchEntityDetail } from "../api";
import { decodeRouteSegment, entityLabels, entityPathToType, getEntityRoute } from "../entityTypes";
import type { CatalogEntityType, EntityDetail, EntityPath } from "../types";
import {
  Badge,
  EmptyState,
  EntityKey,
  FlatDefinitionTable,
  LabelValueBadge,
  MarkdownContent,
  OverviewChip,
  OverviewMetaPanel,
  OverviewMetaRow,
  PageHeader,
  SchemaTable,
  Tabs,
} from "../components/ui";
import {
  flattenValue,
  getBehaviorDefinition,
  getDetailTabs,
  getSchemaPresentation,
  getTargetSelectionDefinition,
  hasStructuredSchema,
} from "../definitionModel";
import { EntityTests } from "../components/tests";
import { HistoryTimeline } from "../components/history";
import { ConditionDisplay, TransformPipeline } from "../components/transforms";
import { useCatalog } from "../context/CatalogContext";

interface DetailContext {
  detail: EntityDetail;
  set?: string;
}
const validPaths: EntityPath[] = [
  "events",
  "attributes",
  "destinations",
  "effects",
  "schemas",
  "targets",
];
function CopyKey({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      type="button"
      title={copied ? "Copied" : "Copy key"}
      aria-label={copied ? "Key copied" : "Copy key"}
      onClick={() => void copy()}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-0 transition-all hover:bg-elevated hover:text-primary group-hover:opacity-100 focus:opacity-100"
    >
      {copied ? (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current">
          <path d="m4 10 4 4 8-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current">
          <rect x="6" y="6" width="10" height="10" rx="2" strokeWidth="1.7" />
          <path
            d="M4 13H3.5A1.5 1.5 0 0 1 2 11.5v-8A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5V4"
            strokeWidth="1.7"
          />
        </svg>
      )}
    </button>
  );
}
export function EntityDetailPage() {
  const manifest = useCatalog();
  const { entityPath, entityKey, setKey } = useParams();
  const set = setKey ? decodeRouteSegment(setKey) : undefined;
  const key = decodeRouteSegment(entityKey || "");
  const [detail, setDetail] = React.useState<EntityDetail>();
  const [error, setError] = React.useState("");
  if (!validPaths.includes(entityPath as EntityPath)) return <Navigate to="/" replace />;
  const type = entityPathToType[entityPath as EntityPath];
  React.useEffect(() => {
    const controller = new AbortController();
    setDetail(undefined);
    setError("");
    fetchEntityDetail(type, key, set, controller.signal)
      .then(setDetail)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
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
  const tabs = getDetailTabs(type, detail.entity);
  const sourceUrl =
    detail.sourcePath && manifest.links?.source
      ? manifest.links.source.replace("{{blobPath}}", detail.sourcePath)
      : undefined;
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
          sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-border bg-elevated px-4 py-2 text-sm font-bold text-muted shadow-sm hover:bg-background"
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
  const { detail, set } = useOutletContext<DetailContext>();
  const entity = detail.entity;
  const hasSchema =
    detail.type === "event" || detail.type === "attribute" || detail.type === "schema";
  const schema = hasSchema ? getSchemaPresentation(detail.effectiveSchema || entity) : undefined;
  const displayType = schema?.root.type || entity.type;
  const facts: Array<[string, unknown]> = [
    ["Level", entity.level],
    ["Transport", entity.transport],
  ];
  const requiredAttributes = Array.isArray(entity.requiredAttributes)
    ? entity.requiredAttributes
    : [];
  const hasDescription = typeof entity.description === "string" && entity.description.trim();
  const hasMetadata = Boolean(
    displayType ||
    facts.some(([, value]) => value !== undefined) ||
    requiredAttributes.length ||
    (detail.type !== "target" && entity.tags?.length) ||
    entity.targets?.length,
  );
  return (
    <div className="space-y-7">
      {hasDescription ? (
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            Description
          </div>
          <MarkdownContent value={entity.description} />
        </section>
      ) : null}
      {hasMetadata ? (
        <OverviewMetaPanel>
          {displayType ? (
            <OverviewMetaRow label="Type">
              <OverviewChip>
                {typeof entity.schema === "string" ? (
                  <Link
                    className="text-primary hover:underline"
                    to={getEntityRoute("schema", entity.schema, set)}
                  >
                    {displayType}
                  </Link>
                ) : (
                  displayType
                )}
              </OverviewChip>
            </OverviewMetaRow>
          ) : null}
          {facts
            .filter(([, value]) => value !== undefined)
            .map(([label, value]) => (
              <OverviewMetaRow key={label} label={label}>
                <OverviewChip>
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </OverviewChip>
              </OverviewMetaRow>
            ))}
          {requiredAttributes.length ? (
            <OverviewMetaRow label="Requires">
              {requiredAttributes.map((attribute: string) => (
                <Link
                  key={attribute}
                  to={getEntityRoute("attribute", attribute, set)}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-primary hover:bg-slate-200"
                >
                  {attribute}
                </Link>
              ))}
            </OverviewMetaRow>
          ) : null}
          {detail.type !== "target" && entity.tags?.length ? (
            <OverviewMetaRow label="Tags">
              {entity.tags.map((tag: string) => (
                <OverviewChip key={tag}>{tag}</OverviewChip>
              ))}
            </OverviewMetaRow>
          ) : null}
          {entity.targets?.length ? (
            <OverviewMetaRow label="Targets">
              {entity.targets.map((target: string) => (
                <Link
                  key={target}
                  to={getEntityRoute("target", target, set)}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-primary hover:bg-slate-200"
                >
                  {target}
                </Link>
              ))}
            </OverviewMetaRow>
          ) : null}
        </OverviewMetaPanel>
      ) : null}
      {hasSchema && hasStructuredSchema(entity) && schema ? (
        <SchemaOverview schema={schema} set={set} />
      ) : null}
    </div>
  );
}

function StructureIntro(props: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-text">{props.title}</h2>
      {props.description ? (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{props.description}</p>
      ) : null}
    </div>
  );
}

function StructureSection(props: { title: string; description?: string; value: unknown }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border bg-elevated/60 px-4 py-3">
        <h3 className="text-sm font-bold text-text">{props.title}</h3>
        {props.description ? (
          <p className="mt-1 text-xs leading-5 text-muted">{props.description}</p>
        ) : null}
      </div>
      <div className="p-4">
        <FlatDefinitionTable rows={flattenValue(props.value)} />
      </div>
    </section>
  );
}

function RuntimeSection(props: { title: string; description?: string; value: unknown }) {
  const value = props.value as Record<string, unknown>;
  const isObject = value && typeof value === "object" && !Array.isArray(value);
  const conditions = isObject ? value.conditions : undefined;
  const transforms = isObject && Array.isArray(value.transforms) ? value.transforms : undefined;
  const rest = isObject
    ? Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "conditions" && key !== "transforms"),
      )
    : value;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border bg-elevated/60 px-4 py-3">
        <h3 className="text-sm font-bold text-text">{props.title}</h3>
        {props.description ? (
          <p className="mt-1 text-xs leading-5 text-muted">{props.description}</p>
        ) : null}
      </div>
      <div className="space-y-5 p-4">
        {isObject && Object.keys(rest as Record<string, unknown>).length ? (
          <FlatDefinitionTable rows={flattenValue(rest)} />
        ) : !isObject ? (
          <FlatDefinitionTable rows={flattenValue(rest)} />
        ) : null}
        {typeof conditions !== "undefined" ? (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Conditions
            </div>
            <ConditionDisplay value={conditions} />
          </div>
        ) : null}
        {transforms ? (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Transforms
            </div>
            <TransformPipeline transforms={transforms} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SchemaOverview({
  schema: { root, rows },
  set,
}: {
  schema: ReturnType<typeof getSchemaPresentation>;
  set?: string;
}) {
  return (
    <section className="space-y-5 border-t border-border pt-7">
      <StructureIntro title="Schema" />
      {root.constraints.length ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
            Root constraints
          </h3>
          <OverviewMetaPanel>
            {root.constraints.map((constraint) => (
              <OverviewMetaRow
                key={constraint.label}
                label={constraint.label.charAt(0).toUpperCase() + constraint.label.slice(1)}
              >
                <OverviewChip>
                  {typeof constraint.value === "string"
                    ? constraint.value
                    : JSON.stringify(constraint.value)}
                </OverviewChip>
              </OverviewMetaRow>
            ))}
          </OverviewMetaPanel>
        </div>
      ) : null}
      {rows.length ? (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
            Structure
          </h3>
          <SchemaTable rows={rows} set={set} />
        </section>
      ) : (
        <EmptyState title="No properties or items are defined." />
      )}
    </section>
  );
}

const behaviorCopy: Record<string, { title: string; description: string }> = {
  conditions: {
    title: "Conditions",
    description: "The conditions that must match before this definition is applied.",
  },
  on: {
    title: "Triggers",
    description: "The event and attribute activity that starts this effect.",
  },
  persist: {
    title: "Persistence",
    description: "Where state or attribute values are retained between operations.",
  },
  sample: {
    title: "Sampling",
    description: "How matching activity is deterministically selected for processing.",
  },
  skipValidation: {
    title: "Validation",
    description: "When payload validation is skipped.",
  },
  state: {
    title: "Initial state",
    description: "The state available when this effect begins processing.",
  },
};

export function BehaviorTab() {
  const { detail } = useOutletContext<DetailContext>();
  const definition = getBehaviorDefinition(detail.type, detail.entity);
  return (
    <div className="space-y-5">
      <StructureIntro
        title="Behavior"
        description="Runtime controls are grouped here separately from the entity's schema and processing structure."
      />
      {Object.entries(definition).map(([key, value]) => {
        const copy = behaviorCopy[key] || {
          title: key,
          description: "Additional runtime configuration for this definition.",
        };
        return (
          <RuntimeSection
            key={key}
            title={copy.title}
            description={copy.description}
            value={key === "conditions" ? { conditions: value } : value}
          />
        );
      })}
    </div>
  );
}

export function TransformsTab() {
  const { detail } = useOutletContext<DetailContext>();
  const transforms = Array.isArray(detail.entity.transforms) ? detail.entity.transforms : [];
  return (
    <div className="space-y-5">
      <StructureIntro
        title="Transforms"
        description="Transforms run from top to bottom. The result of each step becomes the value used by the next step."
      />
      <TransformPipeline transforms={transforms} />
    </div>
  );
}

export function DestinationsTab() {
  const { detail } = useOutletContext<DetailContext>();
  const destinations = detail.entity.destinations || {};
  return (
    <div className="space-y-5">
      <StructureIntro
        title="Destination routing"
        description="Per-destination controls applied after this event is accepted."
      />
      {Object.entries(destinations).map(([destination, override]) => (
        <RuntimeSection
          key={destination}
          title={destination}
          description={
            typeof override === "boolean"
              ? override
                ? "This destination is enabled."
                : "This destination is disabled."
              : "Conditional routing, sampling, and transforms for this destination."
          }
          value={override}
        />
      ))}
    </div>
  );
}

export function StepsTab() {
  const { detail } = useOutletContext<DetailContext>();
  const steps = Array.isArray(detail.entity.steps) ? detail.entity.steps : [];
  return (
    <div className="space-y-5">
      <StructureIntro
        title="Execution steps"
        description="The ordered work performed whenever this effect is triggered."
      />
      {steps.map((step, index) => (
        <RuntimeSection
          key={index}
          title={`Step ${index + 1}${step?.handler ? ` · ${step.handler}` : ""}`}
          description={typeof step?.description === "string" ? step.description : undefined}
          value={step}
        />
      ))}
    </div>
  );
}

export function SelectionTab() {
  const { detail } = useOutletContext<DetailContext>();
  const { filters, output } = getTargetSelectionDefinition(detail.entity);
  return (
    <div className="space-y-5">
      <StructureIntro
        title="Target selection"
        description="The tag and glob-like patterns used to choose definitions for this target."
      />
      <StructureSection
        title="Definition filters"
        description="Included definitions are narrowed by any corresponding exclusions."
        value={filters}
      />
      {Object.keys(output).length ? (
        <StructureSection
          title="Datafile output"
          description="Formatting and revision options used when this target is built."
          value={output}
        />
      ) : null}
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
    <HistoryTimeline path={detail.historyPath} set={set} compact />
  ) : (
    <EmptyState title="No history is available." />
  );
}
