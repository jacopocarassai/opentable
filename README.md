# OpenTable Restaurant Discovery

A restaurant search and discovery prototype built on top of Algolia, using a public OpenTable-style dataset.

**Live demo:** [https://opentable-mu.vercel.app/](https://opentable-mu.vercel.app/)<br>
**Repo:** [https://github.com/jacopocarassai/opentable](https://github.com/jacopocarassai/opentable)

## What this is

I wanted to build something that actually wrestles with two very different kinds of search behavior: people who know exactly which restaurant they want but can't spell it or remember it precisely (especially when it's a chain with multiple locations), and people who are just browsing and want to be inspired. Most demos only show off one of these, so I built the data model, the Algolia configuration, and the frontend around both at once, with an eye on the thing that actually matters commercially: turning a search or browse session into a booking.

## Approach

### Data preparation (`scripts/prepare_data.py`)

The source data comes as two files that need to be joined: `restaurants_list.json` (location, booking links, payment info, 5,000 records) and `restaurants_info.csv` (ratings, cuisine, price, dining style, 5,000 records). Both join cleanly 1:1 on `objectID`, no orphans in either direction.

A few decisions worth calling out:

- **Price is represented twice, and the two signals don't fully agree** (`price` 2 to 4 in the JSON vs. the CSV's `price_range` string). I kept both. `price_tier` (2 to 4, mapped to $$/$$$/$$$$) is the primary filter facet, and `price_range_label` is kept around for display.
- **114 raw `food_type` values** are kept as is for search matching, but I also rolled them up into about 12 `cuisine_category` buckets for browsing. Nobody wants to browse 114 checkboxes, but "Italian" as a facet option makes sense.
- **Chain detection.** Grouping by the exact literal restaurant name only catches 21 names (42 records), things like two identical "Pappas Bros. Steakhouse" entries. The dataset's real pattern is `"<Brand> - <City/Area>"` (for example "Ruth's Chris Steak House - Denver"), which a literal match misses completely since every location's name is technically unique. I switched chain detection to group by a normalized `brand` key (the name with its trailing `" - <location>"` qualifier stripped), which catches 696 records across 203 distinct brands. These get flagged (`is_chain`, `chain_location_count`), and the UI surfaces a `location_label` (neighborhood plus city) prominently so you can tell which "Ruth's Chris Steak House" you're actually looking at.
- **No precomputed popularity score.** `rating` and `review_count` stay as two separate fields and are used as two distinct custom ranking criteria rather than being blended into one number. Keeps the ranking logic transparent and easy to tune from the dashboard.

Run it with:

```bash
python3 scripts/prepare_data.py
```

This reads `data/raw/*` and writes `data/algolia_records.json`.

### Algolia index configuration (`scripts/configure_and_index.mjs`)

```bash
ALGOLIA_APP_ID=... ALGOLIA_ADMIN_API_KEY=... npm run index
```

Configuration choices, mapped back to the two personas:

| Decision | Why |
|---|---|
| `searchableAttributes`: `name` first, then `cuisine`, then `neighborhood`/`city`/`area` | Restaurant name is the dominant signal for known-item search. Cuisine and location matter just as much for the free-text queries a browsing user types, like "sushi denver". `cuisine_category` is deliberately left out of this list, see below. |
| `cuisine_category` kept out of `searchableAttributes` (facet only) | It's a rolled-up browsing bucket, not a literal cuisine value, and some of its labels are ordinary English phrases ("Bars & Small Plates"). Making it searchable meant a query for "bar" prefix-matched "**Bar**s & Small Plates" and surfaced unrelated Fondue, Tapas, and Gastro Pub restaurants. I checked and 150 of 167 records in that category have no literal "bar" in `name` or `cuisine` at all. |
| `ranking` explicitly set to move `geo` to the end (after `custom`) | Algolia's default order (`typo, geo, words, filters, proximity, attribute, exact, custom`) puts geo distance ahead of word match quality and business ranking. Whenever several hits tie on words or typos, which is common for single common words or a term that `allOptional` dropped, results quietly degrade to "nearest restaurant that contains the token anywhere." I confirmed this live with "vegan denver": the top 5 results were vegan or organic restaurants in Connecticut, New York, Indiana, and Missouri, none of them relevant to Denver, ranked above every actual Denver-area restaurant, purely because they happened to sit closer to the test location than Colorado does. Moving `geo` to a true tie-breaker position fixes this without giving up geo-ranking entirely. |
| `customRanking: desc(rating), desc(review_count)` | The business tie-breaker, now evaluated before geo rather than after it. I tested the reverse order too, see "Relevance testing" below for why I kept this one. |
| `attributesForFaceting`: `cuisine_category`, `dining_style`, `price_tier` (facetable), `city`/`is_chain` (filter only) | The three facets someone would actually want to browse by. `city` has 900+ values, so it's filter only (used for a fallback search) rather than a UI facet. |
| `removeWordsIfNoResults: allOptional` | A query like "italian restaurant downtown denver" with no exact match still returns relevant results by progressively dropping words, instead of a blank page. |
| Virtual replica `_rating_desc` | Powers a "Highest rated" sort option without duplicating records or splitting search analytics. The right tool for a sort override, not a different dataset. |

I also found a few real bugs while testing this against live query results, worth documenting since they shaped the final config:

- The chain detection above (literal name matching missing the dominant `"<Brand> - <City>"` pattern) was caught this way. Searching a misspelled "ruths cris steakhouse" correctly returned all 31 Ruth's Chris locations, but none of them showed the chain badge, which is what led me to the brand-key fix described above.
- `cuisine_category` being searchable caused "bar" to return "The Melting Pot" (cuisine: Fondue) in the top 5, matched only through the category label "Bars & Small Plates". That's what led to pulling it out of `searchableAttributes`.
- The default `ranking` formula putting `geo` second meant distance from the searcher could dominate over actual relevance and rating whenever text relevance tied, which is what the "vegan denver" example above shows. Moving `geo` to last fixed it.
- The virtual replica originally tried to override the full `ranking` array, which Algolia rejects (`ApiError: forbidden settings in virtual replicas: ranking`). Virtual replicas can only override `customRanking`, the base formula is always inherited from the primary index. Fixed by only setting `customRanking` on the replica.

All three fixes were verified against the live index afterward: "ruths cris steakhouse" now shows all 31 locations with the chain badge, "bar" dropped from 522 to 371 hits with no more irrelevant category matches, and "vegan denver" now returns only genuine Denver-area restaurants in its top results.

### Frontend (`frontend/`)

Vite plus React plus `react-instantsearch`. I kept the component set deliberately small so the logic is easy to follow:

- `App.jsx`, wires up InstantSearch, requests geolocation once, and only sends `aroundLatLng` once a coordinate is available.
- `useGeolocation.js`, a small hook with an explicit `pending / granted / denied / unsupported` status, so the UI can be honest about what's happening instead of silently guessing.
- `SearchHeader.jsx`, search box, sort selector, and a one line banner explaining why results are ranked the way they are (near you, or by relevance/rating if location isn't available).
- `Filters.jsx`, cuisine, price, and dining style facets.
- `RestaurantCard.jsx`, the result card. Built around the idea of conversion: rating and reviews up front, a clear "Reserve a table" call to action, and a visible warning on chain locations so you don't accidentally book the wrong branch.
- `DroppedTermsBanner.jsx`, a small component that tells you when `allOptional` silently dropped one of your search words (for example searching "vegan denver" when there's no vegan-tagged restaurant in Denver), instead of letting you think every word in your query was honored.

**Location fallback:** if geolocation is denied or unsupported, no `aroundLatLng` is sent. Ranking just skips the geo tie-breaker and falls back to text relevance plus rating and review count. Nothing breaks, and the banner tells you to search by city or neighborhood instead. I went with this over trying to IP-geolocate or forcing a location prompt, which felt like unnecessary complexity for a fallback path.

### Running locally

```bash
# 1. Prepare the data (once)
python3 scripts/prepare_data.py

# 2. Index it into Algolia
ALGOLIA_APP_ID=xxx ALGOLIA_ADMIN_API_KEY=xxx npm run index

# 3. Run the frontend
cd frontend
cp .env.example .env.local   # fill in APP_ID + Search-Only API key
npm install
npm run dev
```

> **The index name needs to match between steps 2 and 3.** Both default to `opentable_restaurants` (`ALGOLIA_INDEX_NAME` for the script, `VITE_ALGOLIA_INDEX_NAME` in `.env.local` for the frontend). This only matters if you rename the index in your Algolia dashboard or pass `ALGOLIA_INDEX_NAME` explicitly, in which case update the other one to match, or the indexing script will happily configure and fill an index the frontend never actually queries.


## What I'd improve with more time

- The current synonym list (7 entries, see `configure_and_index.mjs`, `bbq` and `barbecue` among them) is hand curated from spot checking this dataset, not derived from real query logs. A production version would need a pass against real search terms to find gaps this manual approach missed, plus general plural/singular handling instead of one off entries.
- Algolia Rules for merchandising specific results on seasonal or promoted queries, like boosting newly onboarded restaurants.
- A geocoded "search this city" fallback input for when geolocation is denied, instead of relying on someone typing a city name into the main search box.
- Click and conversion event tracking wired up to Algolia Insights, so ranking could incorporate real behavioral signals instead of only static rating and review count.
- Deeper testing of the cuisine_category rollup against real query data. The grouping here is a reasonable first pass, not a validated taxonomy.
- The dropped terms banner only tells you a word didn't match, not why. A smarter version could distinguish "no inventory here" (like no vegan restaurants in Denver, a real data gap) from "just misspelled," and suggest nearby cities or related cuisines instead of silently falling back.