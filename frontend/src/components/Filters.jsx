import { useState } from "react";
import {
  RefinementList,
  RangeInput,
  ToggleRefinement,
  ClearRefinements,
} from "react-instantsearch";

const PRICE_LABELS = { 2: "$$", 3: "$$$", 4: "$$$$" };

export default function Filters() {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="filters">
      <div className="filters-header">
        <h2>Refine</h2>
        <ClearRefinements translations={{ resetButtonText: "Clear all" }} />
      </div>

      <button
        type="button"
        className="filters-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        {expanded ? "Hide filters" : "Show filters"}
      </button>

      <div className={`filters-body${expanded ? " expanded" : ""}`}>
        <section>
          <h3>Cuisine</h3>
          <RefinementList
            attribute="cuisine_category"
            searchable
            searchablePlaceholder="Search cuisines…"
            limit={6}
            showMoreLimit={20}
            showMore
          />
        </section>

        <section>
          <h3>Price</h3>
          <RefinementList
            attribute="price_tier"
            transformItems={(items) =>
              items
                .map((item) => ({ ...item, label: PRICE_LABELS[item.label] || item.label }))
                .sort((a, b) => a.label.length - b.label.length)
            }
          />
        </section>

        <section>
          <h3>Rating</h3>
          <RangeInput attribute="rating" precision={1} />
        </section>

        <section>
          <h3>Dining style</h3>
          <RefinementList attribute="dining_style" />
        </section>

        <section>
          <h3>Chains</h3>
          <ToggleRefinement attribute="is_chain" label="Chain locations only" />
        </section>
      </div>
    </aside>
  );
}