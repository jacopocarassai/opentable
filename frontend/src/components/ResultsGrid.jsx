import { Hits, Stats, Pagination, useInstantSearch } from "react-instantsearch";
import RestaurantCard from "./RestaurantCard";
import DroppedTermsBanner from "./DroppedTermsBanner";

function EmptyState({ query }) {
  return (
    <div className="empty-state">
      <h3>No restaurants matched "{query}"</h3>
      <p>
        Oh no! We could not find the restaurant you have typed.
      </p>
    </div>
  );
}

export default function ResultsGrid() {
  const { results } = useInstantSearch();

  if (results && results.nbHits === 0) {
    return <EmptyState query={results.query} />;
  }

  return (
    <div className="results">
      <DroppedTermsBanner />
      <Stats
        translations={{
          rootElementText({ nbHits, processingTimeMS }) {
            return `${nbHits.toLocaleString()} restaurants found in ${processingTimeMS}ms`;
          },
        }}
      />
      <Hits hitComponent={RestaurantCard} classNames={{ list: "hits-grid" }} />
      <Pagination />
    </div>
  );
}
