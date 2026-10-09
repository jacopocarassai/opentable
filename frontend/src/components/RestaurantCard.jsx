import { Highlight } from "react-instantsearch";
import { useCompare } from "../context/CompareContext";

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      ★ {rating.toFixed(1)}
    </span>
  );
}

export default function RestaurantCard({ hit }) {
  const { isSelected, toggle, maxReached } = useCompare();
  const selected = isSelected(hit.objectID);
  const disabled = !selected && maxReached;

  return (
    <article className="card">
      <div
        className="card-image"
        style={{ backgroundImage: `url(${hit.image_url})` }}
      >
        {hit.is_chain && (
          <span className="badge badge-chain">
            {hit.chain_location_count} locations
          </span>
        )}
        <span className="badge badge-price">{hit.price_tier_label}</span>
      </div>

      <div className="card-body">
        <h3>
          <Highlight attribute="name" hit={hit} />
        </h3>

        <div className="card-meta">
          <Stars rating={hit.rating} />
          <span className="dot">·</span>
          <span>{hit.review_count.toLocaleString()} reviews</span>
        </div>

        <div className="card-meta secondary">
          <Highlight attribute="cuisine" hit={hit} />
          <span className="dot">·</span>
          <span>{hit.dining_style}</span>
        </div>

        <div className="card-location">
          📍 {hit.location_label}
          {hit.is_chain && (
            <span className="chain-hint"> <br/><b>🔄 This is a chain restaurant, make sure you pick the right one.</b></span>
          )}
        </div>

        <div className="card-actions">
          <a
            className="reserve-button"
            href={hit.reserve_url}
            target="_blank"
            rel="noreferrer"
          >
            Reserve a table
          </a>
          <button
            type="button"
            className={`compare-button${selected ? " active" : ""}`}
            onClick={() => toggle(hit)}
            disabled={disabled}
            title={disabled ? "Comparison list is full" : undefined}
            aria-pressed={selected}
          >
            {selected ? "✓ Comparing" : "+ Compare"}
          </button>
        </div>
      </div>
    </article>
  );
}
