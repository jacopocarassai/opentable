// I made this component to show which word gets dropped after having set removeWordsIfNoResults: "allOptional" in the Algolia account
// More on the topic during my live demo.

import { useInstantSearch } from "react-instantsearch";

export default function DroppedTermsBanner() {
  const { results } = useInstantSearch();

  if (!results || !results.query || results.nbHits === 0) return null;

  const queryWords = results.query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
    
  if (queryWords.length < 2) return null;

  const matchedWords = new Set();
  for (const hit of results.hits) {
    const highlight = hit._highlightResult;
    if (!highlight) continue;
    for (const field of Object.values(highlight)) {
      for (const word of field?.matchedWords || []) {
        matchedWords.add(word.toLowerCase());
      }
    }
  }

  const droppedWords = queryWords.filter((word) => !matchedWords.has(word));
  if (droppedWords.length === 0) return null;

  const keptWords = queryWords.filter((word) => matchedWords.has(word));

  return (
    <p className="dropped-terms-banner tone-neutral">
      No matches for {formatWordList(droppedWords)}. Showing the closest
      results for {formatWordList(keptWords.length ? keptWords : queryWords)} instead.
    </p>
  );
}

function formatWordList(words) {
  return words.map((word) => `"${word}"`).join(" and ");
}