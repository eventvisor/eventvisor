import * as React from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import type { Test } from "@eventvisor/types";
import { DefinitionTree, EmptyState } from "./ui";
import { applyMatrix, combinations } from "../testModel";

function expand(assertion: any) {
  if (!assertion.matrix) return [{ assertion }];
  const { matrix, ...rest } = assertion;
  const cases = combinations(matrix);
  return cases.map((values, index) => ({
    assertion: applyMatrix(rest, values) as any,
    values,
    index,
    count: cases.length,
  }));
}
export function EntityTests({ tests = [], type }: { tests?: Test[]; type: string }) {
  const location = useLocation();
  const [search] = useSearchParams();
  const selected = search.get("assertion");
  React.useEffect(() => {
    if (selected)
      document
        .getElementById(`assertion-${encodeURIComponent(selected)}`)
        ?.scrollIntoView({ block: "start" });
  }, [selected]);
  if (!tests.length) return <EmptyState title={`No tests have been defined for this ${type}.`} />;
  return (
    <div className="space-y-10">
      {tests.map((test: any, testIndex) => (
        <section key={test.key || testIndex} className="space-y-5">
          <header className="border-b border-border pb-3">
            <div className="text-xs uppercase tracking-wide text-faint">
              Test spec {testIndex + 1}
            </div>
            <div className="mt-1 font-mono text-sm font-semibold">{test.key}</div>
          </header>
          {test.assertions.flatMap((assertion: any, assertionIndex: number) =>
            expand(assertion).map((entry: any, caseIndex: number) => {
              const label = `${assertionIndex + 1}${entry.count ? `.${caseIndex + 1}` : ""}`;
              const permalink = `${test.key}:${label}`;
              const params = new URLSearchParams(location.search);
              params.set("assertion", permalink);
              const context = Object.fromEntries(
                Object.entries(entry.assertion).filter(
                  ([key]) => key !== "description" && !key.startsWith("expected"),
                ),
              );
              const expected = Object.fromEntries(
                Object.entries(entry.assertion).filter(([key]) => key.startsWith("expected")),
              );
              return (
                <article
                  id={`assertion-${encodeURIComponent(permalink)}`}
                  key={permalink}
                  className={`scroll-mt-6 rounded-xl border bg-surface p-5 ${selected === permalink ? "border-primary ring-2 ring-primary/15" : "border-border"}`}
                >
                  <header className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">Assertion {label}</h3>
                      {entry.count && (
                        <span className="rounded-full bg-pill px-2 py-1 text-xs text-muted">
                          Matrix case {caseIndex + 1} of {entry.count}
                        </span>
                      )}
                    </div>
                    <Link
                      title="Link to this assertion"
                      className="text-faint hover:text-primary"
                      to={{ pathname: location.pathname, search: params.toString() }}
                    >
                      ¶
                    </Link>
                  </header>
                  {entry.assertion.description && (
                    <p className="mb-4 text-sm text-muted">{entry.assertion.description}</p>
                  )}
                  <div className="space-y-5">
                    <section>
                      <div className="mb-2 text-xs font-semibold uppercase text-faint">Context</div>
                      {entry.values && (
                        <div className="mb-3">
                          <div className="mb-2 text-xs text-muted">Matrix values</div>
                          <DefinitionTree value={entry.values} />
                        </div>
                      )}
                      {Object.keys(context).length ? (
                        <DefinitionTree value={context} />
                      ) : (
                        <p className="text-sm text-faint">No context configured.</p>
                      )}
                    </section>
                    <section>
                      <div className="mb-2 text-xs font-semibold uppercase text-faint">
                        Expected
                      </div>
                      {Object.keys(expected).length ? (
                        <DefinitionTree value={expected} />
                      ) : (
                        <p className="text-sm text-faint">No expectations configured.</p>
                      )}
                    </section>
                  </div>
                </article>
              );
            }),
          )}
        </section>
      ))}
    </div>
  );
}
