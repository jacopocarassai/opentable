import { useState } from "react";
import { InstantSearch, Configure } from "react-instantsearch";
import { searchClient, indexName } from "./algoliaClient";
import { useGeolocation } from "./useGeolocation";
import { CompareProvider } from "./context/CompareContext";
import SearchHeader from "./components/SearchHeader";
import Filters from "./components/Filters";
import ResultsGrid from "./components/ResultsGrid";
import MapView from "./components/MapView";
import CompareTray from "./components/CompareTray";
import CompareModal from "./components/CompareModal";
import ThemeToggle from "./components/ThemeToggle";

import "./App.css";

export default function App() {
  const { status, coords } = useGeolocation();
  const [view, setView] = useState("list");

  return (
    <CompareProvider>
    <InstantSearch searchClient={searchClient} indexName={indexName}>
      {coords && (
        <Configure
          aroundLatLng={`${coords.lat}, ${coords.lng}`}
          aroundRadius="all"
          getRankingInfo={true}
        />
      )}

      <div className="app-shell">
        <SearchHeader geoStatus={status} />

        <div className="view-toggle" role="tablist" aria-label="Results view">
          <button
            type="button"
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={view === "map" ? "active" : ""}
            onClick={() => setView("map")}
          >
            Map
          </button>
        </div>

        <div className="app-body">
          <Filters />
          {view === "list" ? <ResultsGrid /> : <MapView userCoords={coords} />}
        </div>
      </div>

      <CompareTray />
      <CompareModal />
      <ThemeToggle />
    </InstantSearch>
    </CompareProvider>
  );
}
