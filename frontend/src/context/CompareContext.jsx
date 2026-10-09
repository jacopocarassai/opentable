import { createContext, useContext, useState, useCallback, useMemo } from "react";

const CompareContext = createContext(null);

// Bounded on purpose: a comparison table stops being scannable well
// before you'd hit this, and it keeps the tray from overflowing.
const MAX_COMPARE = 4;

export function CompareProvider({ children }) {
  const [selected, setSelected] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const isSelected = useCallback(
    (objectID) => selected.some((hit) => hit.objectID === objectID),
    [selected]
  );

  const toggle = useCallback((hit) => {
    setSelected((prev) => {
      const exists = prev.some((h) => h.objectID === hit.objectID);
      if (exists) return prev.filter((h) => h.objectID !== hit.objectID);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, hit];
    });
  }, []);

  const remove = useCallback((objectID) => {
    setSelected((prev) => prev.filter((h) => h.objectID !== objectID));
  }, []);

  const clear = useCallback(() => {
    setSelected([]);
    setModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      selected,
      isSelected,
      toggle,
      remove,
      clear,
      modalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      maxReached: selected.length >= MAX_COMPARE,
      max: MAX_COMPARE,
    }),
    [selected, isSelected, toggle, remove, clear, modalOpen]
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within a CompareProvider");
  return ctx;
}
