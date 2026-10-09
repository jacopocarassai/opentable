#!/usr/bin/env python3
"""
Data preparation script for the OpenTable restaurant discovery demo.

Joins restaurants_list.json (location/booking data) with
restaurants_info.csv (ratings/cuisine/pricing data) on `objectID`,
cleans and enriches the combined records, and writes a single JSON
array ready to be pushed into an Algolia index.

Usage:
    python3 scripts/prepare_data.py \
        --json data/raw/restaurants_list.json \
        --csv data/raw/restaurants_info.csv \
        --out data/algolia_records.json

Design decisions (see README.md "Data preparation" section for the
full write-up):

1. Join key: `objectID` is present and unique in both files (5,000
   records each, full 1:1 match, no orphans in either direction).

2. Price is represented twice in the source data and the two
   signals don't perfectly agree (e.g. a record can be `price: 2`
   from the JSON file but `price_range: "$31 to $50"` from the CSV).
   Rather than silently picking one, we keep both:
     - `price_tier` (2-4, mapped to $$/$$$/$$$$) from the JSON file,
       used as the primary facet/filter because it's a clean small
       enum that's easy for users to filter on.
     - `price_range_label` (the CSV's descriptive string) kept for
       display, since it's more specific for a user deciding whether
       a restaurant fits their budget.

3. `food_type` (114 distinct values from the CSV) is kept as-is for
   full-text search and a detailed facet, but is also rolled up into
   a smaller `cuisine_category` (~12 buckets) via a hand-built
   mapping. The granular list is too long to be a useful *browsing*
   facet (the discovery persona), but is valuable for search
   matching and power-user filtering. The mapping is a judgment call
   documented in CUISINE_MAP below; a true production rollout would
   confirm these groupings with the customer.

4. Chain detection: grouping by the *literal* restaurant name only
   catches 21 names (42 records) -- e.g. "Pappas Bros. Steakhouse"
   appears twice, verbatim, in different cities. But the dominant
   naming convention for multi-location chains in this dataset is
   "<Brand> - <City/Area>" (e.g. "Ruth's Chris Steak House -
   Denver", "... - Houston"), which a literal-name match completely
   misses since every location's string is unique. Checked: 696 of
   5,000 records (203 distinct brands) actually belong to a chain
   with 2+ locations once you group by the name with its trailing
   " - <location>" qualifier stripped -- e.g. Ruth's Chris Steak
   House alone has 31 locations, none of which were being flagged.
   So chain detection groups by this normalized `brand` key instead
   of the raw name, and `chain_location_count` is the size of that
   brand group. This directly matches the "users struggle to pick
   the right location for a chain" pain point in the discovery
   notes. We flag these with `is_chain` and `chain_location_count`,
   and add a `location_label` field (neighborhood + city) that the
   UI surfaces prominently in results and in the search dropdown so
   a user can disambiguate at a glance.

5. `_geoloc` is already in Algolia's native `{lat, lng}` shape in the
   source JSON, so it's passed through unchanged to support
   geo-ranking and "near me" style queries.

6. No numeric "popularity score" is precomputed. `stars_count`
   (rating) and `reviews_count` are kept as separate attributes and
   used as two distinct custom ranking criteria in the Algolia index
   configuration, rather than being blended into a single magic
   number. This keeps the ranking logic transparent and tunable
   directly in the Algolia dashboard.

7. Phone numbers: the CSV's `phone_number` is already
   human-formatted ("(216) 378-8988") and is kept for display; the
   JSON's digits-only `phone` is kept separately as `phone_tel` for
   `tel:` links.
"""

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict

# Rolls the 114 granular food_type values from the CSV into a smaller
# set of browsable cuisine categories. Anything not listed falls back
# to "Other" (and is printed as a warning so it doesn't silently vanish).
CUISINE_MAP = {
    "Italian": "Italian", "Contemporary Italian": "Italian", "Sicilian": "Italian",
    "French": "French", "Contemporary French": "French", "French American": "French",
    "Contemporary French / American": "French", "Provencal": "French",
    "American": "American", "Contemporary American": "American", "Southern": "American",
    "Contemporary Southern": "American", "Creole": "American",
    "Creole / Cajun / Southern": "American", "Cajun": "American", "Barbecue": "American",
    "Comfort Food": "American", "Tex-Mex": "American", "Southwest": "American",
    "Mexican / Southwestern": "American", "Prime Rib": "American", "Steak": "American",
    "Steakhouse": "American", "Brazilian Steakhouse": "American", "Low Country": "American",
    "Hawaiian": "American", "Hawaii Regional Cuisine": "American", "Burgers": "American",
    "Breakfast": "American",
    "Mexican": "Mexican & Latin American", "Regional Mexican": "Mexican & Latin American",
    "Traditional Mexican": "Mexican & Latin American",
    "Contemporary Mexican": "Mexican & Latin American",
    "Latin American": "Mexican & Latin American", "Latin / Spanish": "Mexican & Latin American",
    "Caribbean": "Mexican & Latin American", "Cuban": "Mexican & Latin American",
    "Puerto Rican": "Mexican & Latin American", "Peruvian": "Mexican & Latin American",
    "South American": "Mexican & Latin American", "Brazilian": "Mexican & Latin American",
    "Argentinean": "Mexican & Latin American",
    "Asian": "Asian", "Chinese": "Asian", "Japanese": "Asian", "Sushi": "Asian",
    "Thai": "Asian", "Vietnamese": "Asian", "Korean": "Asian", "Dim Sum": "Asian",
    "Pan-Asian": "Asian", "Southeast Asian": "Asian", "Hibachi": "Asian",
    "Contemporary Asian": "Asian", "Pacific Rim": "Asian", "Filipino": "Asian",
    "Burmese": "Asian", "Polynesian": "Asian", "Fusion / Eclectic": "Asian",
    "Indian": "Indian", "Contemporary Indian": "Indian", "South Indian": "Indian",
    "Mediterranean": "Mediterranean & Middle Eastern",
    "Middle Eastern": "Mediterranean & Middle Eastern", "Lebanese": "Mediterranean & Middle Eastern",
    "Turkish": "Mediterranean & Middle Eastern", "Persian": "Mediterranean & Middle Eastern",
    "Moroccan": "Mediterranean & Middle Eastern", "Greek": "Mediterranean & Middle Eastern",
    "Afghan": "Mediterranean & Middle Eastern", "Syrian": "Mediterranean & Middle Eastern",
    "European": "European", "Contemporary European": "European", "Modern European": "European",
    "Eastern European": "European", "British": "European", "Irish": "European",
    "German": "European", "Austrian": "European", "Swiss": "European",
    "Scandinavian": "European", "Russian": "European", "Belgian": "European",
    "Portuguese": "European", "Spanish": "European", "Basque": "European",
    "English": "European", "Continental": "European",
    "Seafood": "Seafood",
    "Vegan": "Vegetarian & Vegan", "Vegetarian": "Vegetarian & Vegan", "Organic": "Vegetarian & Vegan",
    "African": "African", "Ethiopian": "African", "South African": "African",
    "Global, International": "Global & International", "International": "Global & International",
    "Eurasian": "Global & International", "Modern Australian": "Global & International",
    "Australian": "Global & International", "Northwest": "Global & International",
    "Californian": "Global & International",
    "Bar / Lounge / Bottle Service": "Bars & Small Plates", "Beer Garden": "Bars & Small Plates",
    "Brewery": "Bars & Small Plates", "Wine Bar": "Bars & Small Plates",
    "Gastro Pub": "Bars & Small Plates", "Bistro": "Bars & Small Plates",
    "Tapas / Small Plates": "Bars & Small Plates", "Afternoon Tea": "Bars & Small Plates",
    "Fondue": "Bars & Small Plates", "Kosher": "Bars & Small Plates",
    "Wild Game": "Bars & Small Plates", "Pizzeria": "Bars & Small Plates",
}

PRICE_TIER_LABELS = {2: "$$", 3: "$$$", 4: "$$$$"}


def load_json_records(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_csv_records(path):
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        return list(reader)


def brand_name(name):
    """Strip a trailing ' - <location>' qualifier (e.g. 'Ruth's Chris
    Steak House - Denver' -> 'Ruth's Chris Steak House'), which is how
    this dataset disambiguates chain locations in the name itself.
    Restaurants with no such qualifier are returned unchanged, so a
    one-off restaurant's own name is never altered."""
    return name.split(" - ")[0].strip()


def build_records(json_records, csv_records):
    csv_by_id = {row["objectID"]: row for row in csv_records}

    # Detect chains by brand (the name with any trailing
    # " - <location>" qualifier stripped) so multi-location chains
    # that disambiguate via a location suffix -- the dominant
    # pattern in this dataset -- are flagged for the
    # known-item-search disambiguation UX, not just the rarer case
    # where every location shares the exact same literal name.
    brand_counts = Counter(brand_name(r["name"].strip()) for r in json_records)

    out = []
    warnings = Counter()

    for r in json_records:
        oid = str(r["objectID"])
        info = csv_by_id.get(oid)
        if info is None:
            warnings["missing_csv_row"] += 1
            continue

        food_type = info["food_type"].strip()
        cuisine_category = CUISINE_MAP.get(food_type)
        if cuisine_category is None:
            cuisine_category = "Other"
            warnings[f"unmapped_cuisine:{food_type}"] += 1

        try:
            price_tier = int(r["price"])
        except (TypeError, ValueError):
            price_tier = None

        try:
            rating = float(info["stars_count"])
        except (TypeError, ValueError):
            rating = None

        try:
            review_count = int(info["reviews_count"])
        except (TypeError, ValueError):
            review_count = 0

        name = r["name"].strip()
        brand = brand_name(name)
        is_chain = brand_counts[brand] > 1

        record = {
            "objectID": oid,
            "name": name,
            "is_chain": is_chain,
            "chain_location_count": brand_counts[brand] if is_chain else 1,

            # Cuisine
            "cuisine": food_type,
            "cuisine_category": cuisine_category,

            # Style & price
            "dining_style": info["dining_style"].strip(),
            "price_tier": price_tier,
            "price_tier_label": PRICE_TIER_LABELS.get(price_tier, "N/A"),
            "price_range_label": info["price_range"].strip(),

            # Quality signals (used as custom ranking criteria)
            "rating": rating,
            "review_count": review_count,

            # Location
            "address": r["address"],
            "neighborhood": info["neighborhood"].strip(),
            "location_label": f"{info['neighborhood'].strip()}, {r['city']}",
            "city": r["city"],
            "area": r["area"],
            "state": r["state"],
            "postal_code": r["postal_code"],
            "country": r["country"],
            "_geoloc": r["_geoloc"],

            # Contact / booking
            "phone_display": info["phone_number"].strip(),
            "phone_tel": r["phone"],
            "reserve_url": r["reserve_url"],
            "mobile_reserve_url": r["mobile_reserve_url"],
            "payment_options": r["payment_options"],
            "image_url": r["image_url"],
        }
        out.append(record)

    return out, warnings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", default="data/raw/restaurants_list.json")
    parser.add_argument("--csv", default="data/raw/restaurants_info.csv")
    parser.add_argument("--out", default="data/algolia_records.json")
    args = parser.parse_args()

    json_records = load_json_records(args.json)
    csv_records = load_csv_records(args.csv)

    records, warnings = build_records(json_records, csv_records)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"Joined {len(records)} records -> {args.out}")
    if warnings:
        print("\nWarnings:")
        for k, v in sorted(warnings.items()):
            print(f"  {k}: {v}")

    chains = [r for r in records if r["is_chain"]]
    print(f"\n{len(chains)} records belong to a chain with multiple locations "
          f"({len(set(r['name'] for r in chains))} distinct chain names).")

    cats = Counter(r["cuisine_category"] for r in records)
    print(f"\nCuisine categories ({len(cats)}):")
    for cat, count in cats.most_common():
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
