import React from "react";
import { HashRouter, Routes, Route, useNavigate } from "react-router";
import { Catalog } from "@eventvisor/types";

import { Navbar } from "./navbar";
import { Content } from "./content";
import { PageEvents } from "./page-events";
import { PageEventsView, DisplayEventOverview } from "./page-events-view";
import { PageAttributes } from "./page-attributes";
import { PageAttributesView, DisplayAttributeOverview } from "./page-attributes-view";
import { PageDestinations } from "./page-destinations";
import { PageDestinationsView, DisplayDestinationOverview } from "./page-destinations-view";
import { PageEffects } from "./page-effects";
import { PageEffectsView, DisplayEffectOverview } from "./page-effects-view";
import { CatalogContext } from "../contexts";

import { Alert } from "./alert";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    navigate("/events");
  }, []);

  return (
    <Content title="Home">
      <div className="mt-6">
        <Alert type="warning">Loading...</Alert>
      </div>
    </Content>
  );
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl pb-4 mx-auto mt-10 bg-white min-h-60 rounded-md shadow">
      {children}
    </div>
  );
}

export const Root: React.FC = () => {
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);

  React.useEffect(() => {
    fetch("/catalog.json")
      .then((response) => response.json())
      .then((data) => setCatalog(data as Catalog));
  }, []);

  if (!catalog) {
    return (
      <HashRouter>
        <Navbar />

        <Wrapper>
          <Content title="Home">
            <div className="mt-6">
              <Alert type="warning">Loading...</Alert>
            </div>
          </Content>
        </Wrapper>
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <Navbar />

      <Wrapper>
        <CatalogContext.Provider value={catalog}>
          <Routes>
            <Route path="/" element={<HomePage />} />

            <Route path="attributes">
              <Route index element={<PageAttributes />} />
              <Route path=":name" element={<PageAttributesView />}>
                <Route index element={<DisplayAttributeOverview />} />
              </Route>
            </Route>

            <Route path="events">
              <Route index element={<PageEvents />} />
              <Route path=":name" element={<PageEventsView />}>
                <Route index element={<DisplayEventOverview />} />
              </Route>
            </Route>

            <Route path="destinations">
              <Route index element={<PageDestinations />} />
              <Route path=":name" element={<PageDestinationsView />}>
                <Route index element={<DisplayDestinationOverview />} />
              </Route>
            </Route>

            <Route path="effects">
              <Route index element={<PageEffects />} />
              <Route path=":name" element={<PageEffectsView />}>
                <Route index element={<DisplayEffectOverview />} />
              </Route>
            </Route>
          </Routes>
        </CatalogContext.Provider>
      </Wrapper>

      <div className="text-xs text-zinc-500 mt-10 text-center pb-10">
        Built with{" "}
        <a target="_blank" href="https://eventvisor.org">
          Eventvisor
        </a>
      </div>
    </HashRouter>
  );
};
