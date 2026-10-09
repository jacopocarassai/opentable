import { useCompare } from "../context/CompareContext";

export default function CompareTray() {
  const { selected, remove, clear, openModal, max } = useCompare();

  if (selected.length === 0) return null;

  return (
    <div className="compare-tray" role="region" aria-label="Restaurants selected for comparison">
      <div className="compare-tray-chips">
        {selected.map((hit) => (
          <span className="compare-chip" key={hit.objectID}>
            {hit.name}
            <button
              type="button"
              className="compare-chip-remove"
              onClick={() => remove(hit.objectID)}
              aria-label={`Remove ${hit.name} from comparison`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="compare-tray-actions">
        <span className="compare-tray-count">
          {selected.length}/{max} selected
        </span>
        <button type="button" className="compare-tray-clear" onClick={clear}>
          Clear
        </button>
        <button
          type="button"
          className="compare-tray-open"
          onClick={openModal}
          disabled={selected.length < 2}
          title={selected.length < 2 ? "Pick at least 2 to compare" : undefined}
        >
          Compare
        </button>
      </div>
    </div>
  );
}
