import { RefinementList, ClearRefinements } from "react-instantsearch";

const PRICE_LABELS = { 2: "$$", 3: "$$$", 4: "$$$$" };

export default function Filters() {
  return (
    <aside className="filters">
      <div className="filters-header">
        <h2>Refine</h2>
        <ClearRefinements translations={{ resetButtonText: "Clear all" }} />
      </div>

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
        <h3>Dining style</h3>
        <RefinementList attribute="dining_style" />
      </section>
    </aside>
  );
}
