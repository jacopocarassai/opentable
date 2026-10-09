import { algoliasearch } from "algoliasearch";

const appId = import.meta.env.VITE_ALGOLIA_APP_ID;
const searchKey = import.meta.env.VITE_ALGOLIA_SEARCH_KEY;

export const indexName = import.meta.env.VITE_ALGOLIA_INDEX_NAME || "opentable_restaurants";

if (!appId || !searchKey) {
  console.error(
    "Missing VITE_ALGOLIA_APP_ID / VITE_ALGOLIA_SEARCH_KEY. Copy .env.example to .env.local and fill them in."
  );
}

export const searchClient = algoliasearch(appId, searchKey);
