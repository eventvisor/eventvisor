import { getTransformPresentation, type TransformFlowValue } from "../transformModel";
import { getConditionPresentation, type ConditionPresentation } from "../conditionModel";

function Value({ value }: { value: unknown }) {
  if (typeof value === "undefined") return <span className="text-faint">Current value</span>;
  if (typeof value === "string") {
    return (
      <span className="font-mono text-xs [overflow-wrap:anywhere]">
        {value.trim() ? value : JSON.stringify(value)}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs [overflow-wrap:anywhere]">{JSON.stringify(value)}</span>
  );
}

function FlowEndpoint({ item }: { item: TransformFlowValue }) {
  return (
    <div className="min-w-0 py-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
        {item.label}
      </div>
      {typeof item.value !== "undefined" ? (
        <div className="mt-1 text-sm font-medium text-text">
          <Value value={item.value} />
        </div>
      ) : null}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-faint" aria-hidden="true">
      <svg viewBox="0 0 20 20" className="hidden h-5 w-5 md:block">
        <path
          d="M3 10h13m-4-4 4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
      <svg viewBox="0 0 20 20" className="h-5 w-5 md:hidden">
        <path
          d="M10 3v13m-4-4 4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

function ConditionValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <span className="inline-flex flex-wrap gap-1">
        {value.map((item, index) => (
          <span
            key={index}
            className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-text"
          >
            {typeof item === "string" ? item : JSON.stringify(item)}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-text">
      {typeof value === "string" ? value : JSON.stringify(value)}
    </span>
  );
}

function ConditionNode({ condition }: { condition: ConditionPresentation }) {
  if (condition.kind === "always" || condition.kind === "unknown") {
    return <div className="py-1.5 text-sm text-muted">{condition.label}</div>;
  }

  if (condition.kind === "group") {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text">
            {condition.label}
          </span>
          <span className="text-xs text-muted">{condition.description}</span>
        </div>
        <div className="ml-3 mt-2 divide-y divide-border border-l-2 border-slate-200 pl-4">
          {condition.children.map((child, index) => (
            <div key={index} className="py-1.5">
              <ConditionNode condition={child} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (condition.kind !== "leaf") return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-1 text-sm">
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {condition.source.label}
      </span>
      <Value value={condition.source.value} />
      <span className="text-muted">{condition.operatorLabel}</span>
      {typeof condition.value !== "undefined" ? <ConditionValue value={condition.value} /> : null}
      {condition.regexFlags ? (
        <span className="text-xs text-faint">flags: {condition.regexFlags}</span>
      ) : null}
    </div>
  );
}

export function ConditionDisplay({ value }: { value: unknown }) {
  return (
    <div className="rounded-lg bg-elevated px-4 py-3">
      <ConditionNode condition={getConditionPresentation(value)} />
    </div>
  );
}

function ConditionSummary({ value }: { value: unknown }) {
  return (
    <section className="mt-4 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-muted">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5 fill-none stroke-current"
          >
            <path d="M4 5h12M6.5 10h7M9 15h2" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h4 className="text-xs font-bold text-text">Runs only when</h4>
          <p className="text-[11px] text-faint">Checked before this transform is applied</p>
        </div>
      </div>
      <div className="mt-3">
        <ConditionDisplay value={value} />
      </div>
    </section>
  );
}

export function TransformPipeline({ transforms }: { transforms: unknown[] }) {
  return (
    <ol className="overflow-hidden rounded-xl border border-border bg-surface">
      {transforms.map((transform, index) => {
        const step = getTransformPresentation(transform);
        const isLast = index === transforms.length - 1;
        return (
          <li
            key={index}
            className={`grid grid-cols-[3.5rem_minmax(0,1fr)] ${
              isLast ? "" : "border-b border-border"
            }`}
          >
            <div className="relative flex justify-center bg-elevated/50 pt-5" aria-hidden="true">
              <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
                {index + 1}
              </span>
              {!isLast ? <span className="absolute bottom-0 top-12 w-px bg-border" /> : null}
            </div>

            <div className="min-w-0 px-5 py-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Step {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-0.5 text-sm font-bold text-text">{step.summary}</h3>
              </div>

              <div className="mt-4 grid gap-2 rounded-lg bg-elevated px-4 py-3 md:grid-cols-[minmax(0,1fr)_2rem_minmax(9rem,0.8fr)_2rem_minmax(0,1fr)] md:items-center">
                <FlowEndpoint item={step.input} />
                <FlowArrow />
                <div className="text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                    Transform
                  </div>
                  <div className="mt-1 text-sm font-semibold text-text">{step.operation}</div>
                  {step.details.length ? (
                    <dl className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                      {step.details.map((detail) => (
                        <div key={detail.label} className="flex items-baseline gap-1 text-xs">
                          <dt className="text-faint">{detail.label}</dt>
                          <dd className="font-mono text-muted">
                            <Value value={detail.value} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
                <FlowArrow />
                <FlowEndpoint item={step.output} />
              </div>

              {step.mappings.length ? (
                <div className="mt-4">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                    Path mappings
                  </div>
                  <div className="divide-y divide-border rounded-lg bg-elevated px-3">
                    {step.mappings.map((mapping, mappingIndex) => (
                      <div
                        key={`${mapping.from}-${mapping.to}-${mappingIndex}`}
                        className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center gap-2 py-2 text-xs"
                      >
                        <code className="[overflow-wrap:anywhere]">{mapping.from}</code>
                        <span className="text-center text-faint" aria-hidden="true">
                          →
                        </span>
                        <code className="[overflow-wrap:anywhere]">{mapping.to}</code>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {typeof step.conditions !== "undefined" ? (
                <ConditionSummary value={step.conditions} />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
