import { useEffect } from "react";
import { useCompare } from "../context/CompareContext";

const ROWS = [
  { label: "Cuisine", render: (hit) => hit.cuisine },
  { label: "Price", render: (hit) => hit.price_range_label || hit.price_tier_label },
  {
    label: "Rating",
    render: (hit) => (hit.rating ? `★ ${hit.rating.toFixed(1)}` : "—"),
  },
  { label: "Reviews", render: (hit) => hit.review_count?.toLocaleString() ?? "—" },
  { label: "Dining style", render: (hit) => hit.dining_style },
  { label: "Neighborhood", render: (hit) => hit.location_label },
  {
    label: "Chain",
    render: (hit) =>
      hit.is_chain ? `${hit.chain_location_count} locations — check address` : "Single location",
  },
];

export default function CompareModal() {
  const { selected, modalOpen, closeModal, remove } = useCompare();

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  if (!modalOpen || selected.length < 2) return null;

  return (
    <div className="compare-modal-overlay" onClick={closeModal}>
      <div
        className="compare-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Compare restaurants"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="compare-modal-header">
          <h2>Compare restaurants</h2>
          <button type="button" className="compare-modal-close" onClick={closeModal} aria-label="Close">
            ×
          </button>
        </div>

        <div className="compare-modal-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                {selected.map((hit) => (
                  <th key={hit.objectID}>
                    <div className="compare-table-name">{hit.name}</div>
                    <button
                      type="button"
                      className="compare-table-remove"
                      onClick={() => remove(hit.objectID)}
                    >
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {selected.map((hit) => (
                    <td key={hit.objectID}>{row.render(hit) ?? "—"}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row"></th>
                {selected.map((hit) => (
                  <td key={hit.objectID}>
                    <a className="reserve-button" href={hit.reserve_url} target="_blank" rel="noreferrer">
                      Reserve a table
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
