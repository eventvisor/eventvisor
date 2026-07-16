import * as React from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import type { Test } from "@eventvisor/types";
import { DefinitionTree, EmptyState } from "./ui";
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
          {test.assertions.map((authoredAssertion: any, expandedIndex: number) => {
            const metadata = authoredAssertion.__catalog || { assertionIndex: expandedIndex };
            const assertion = { ...authoredAssertion };
            delete assertion.__catalog;
            const label = `${metadata.assertionIndex + 1}${typeof metadata.matrixIndex === "number" ? `.${metadata.matrixIndex + 1}` : ""}`;
            const permalink = `${test.key}:${label}`;
            const params = new URLSearchParams(location.search);
            params.set("assertion", permalink);
            const context = Object.fromEntries(
              Object.entries(assertion).filter(
                ([key]) => key !== "description" && !key.startsWith("expected"),
              ),
            );
            const expected = Object.fromEntries(
              Object.entries(assertion).filter(([key]) => key.startsWith("expected")),
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
                    {metadata.matrixCount && (
                      <span className="rounded-full bg-pill px-2 py-1 text-xs text-muted">
                        Matrix case {metadata.matrixIndex + 1} of {metadata.matrixCount}
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
                {assertion.description && (
                  <p className="mb-4 text-sm text-muted">{assertion.description}</p>
                )}
                <div className="space-y-5">
                  <section>
                    <div className="mb-2 text-xs font-semibold uppercase text-faint">Context</div>
                    {metadata.matrixValues && (
                      <div className="mb-3">
                        <div className="mb-2 text-xs text-muted">Matrix values</div>
                        <DefinitionTree value={metadata.matrixValues} />
                      </div>
                    )}
                    {Object.keys(context).length ? (
                      <DefinitionTree value={context} />
                    ) : (
                      <p className="text-sm text-faint">No context configured.</p>
                    )}
                  </section>
                  <section>
                    <div className="mb-2 text-xs font-semibold uppercase text-faint">Expected</div>
                    {Object.keys(expected).length ? (
                      <DefinitionTree value={expected} />
                    ) : (
                      <p className="text-sm text-faint">No expectations configured.</p>
                    )}
                  </section>
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
