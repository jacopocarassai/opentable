import { SearchBox, SortBy } from "react-instantsearch";
import { indexName } from "../algoliaClient";
import opentableLogoLight from "../assets/opentable-logo-light.png";
import opentableLogoDark from "../assets/opentable-logo-dark.png";

const LOCATION_COPY = {
  pending: { text: "Finding restaurants near you…", tone: "neutral" },
  granted: { text: "Showing results ranked with restaurants near you first.", tone: "positive" },
  denied: {
    text: "Location unavailable — showing results ranked by relevance and rating instead. Try searching a city or neighborhood.",
    tone: "neutral",
  },
  unsupported: {
    text: "Your browser doesn't support location — showing results ranked by relevance and rating instead.",
    tone: "neutral",
  },
};

export default function SearchHeader({ geoStatus }) {
  const banner = LOCATION_COPY[geoStatus];

  return (
    <div className="search-header">
      <img src={opentableLogoLight} alt="Open Table" className="logo logo-light" width={400}/>
      <img src={opentableLogoDark} alt="Open Table" className="logo logo-dark" width={400}/>
      <div className="search-row">
        <SearchBox
          placeholder="Search by restaurant, cuisine, or neighborhood…"
          autoFocus
        />
        <SortBy
          items={[
            { label: "Most relevant", value: indexName },
            { label: "Highest rated", value: `${indexName}_rating_desc` },
          ]}
        />
      </div>
      {banner && <p className={`location-banner tone-${banner.tone}`}>{banner.text}</p>}
    </div>
  );
}