import { useParams } from "react-router";
import { HistoryTimeline } from "../components/history";
import { PageHeader } from "../components/ui";
import { useCatalog } from "../context/CatalogContext";
import { decodeRouteSegment, getDataBasePath } from "../entityTypes";
export function HistoryPage() {
  const { setKey } = useParams();
  const set = setKey ? decodeRouteSegment(setKey) : undefined;
  const manifest = useCatalog();
  const path = set
    ? `${getDataBasePath(set)}/history`
    : manifest.sets
      ? manifest.paths.projectHistory
      : `${getDataBasePath()}/history`;
  return (
    <>
      <PageHeader
        title="History"
        description={set ? `Changes in the ${set} Set` : "Changes across this project"}
      />
      <div className="px-6 pb-6">
        <HistoryTimeline path={path} set={set} />
      </div>
    </>
  );
}
