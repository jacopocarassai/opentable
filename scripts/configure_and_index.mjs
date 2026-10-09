// I made this file so if something happens to my Algolia account, here are all the tuning settings I have done for this test

import { algoliasearch } from "algoliasearch";
import { readFile } from "node:fs/promises";

const APP_ID = process.env.ALGOLIA_APP_ID;
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_API_KEY;
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "opentable_restaurants";

if (!APP_ID || !ADMIN_KEY) {
  console.error(
    "Missing ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY environment variables."
  );
  process.exit(1);
}

const client = algoliasearch(APP_ID, ADMIN_KEY);

async function main() {
  const raw = await readFile(
    new URL("../data/algolia_records.json", import.meta.url)
  );
  const records = JSON.parse(raw);
  console.log(`Loaded ${records.length} records from data/algolia_records.json`);

  
  const ratingReplicaName = `${INDEX_NAME}_rating_desc`;

  const settings = {
    searchableAttributes: [
      "name",
      "cuisine",
      "neighborhood,city,area",
    ],
    attributesForFaceting: [
      "cuisine_category",
      "dining_style",
      "price_tier",
      "rating",
      "is_chain",
      "filterOnly(city)",
    ],

    // I am ranking geo at the bottom. This is because I noticed that when there was no query, the map layer was showing only a specific set
    // of restaurants closed to my browsing GPS position (Berlin).
    // With de-ranking geo as last tie-breaker, the map layer users see "most relevant" results, rather than "close to you"
    ranking: [
      "typo",
      "words",
      "filters",
      "proximity",
      "attribute",
      "exact",
      "custom",
      "geo",
    ],
    customRanking: ["desc(rating)", "desc(review_count)"],
    attributesToHighlight: ["name", "cuisine", "neighborhood", "city"],
    attributesToSnippet: [],
    removeWordsIfNoResults: "allOptional",
    typoTolerance: true,
    minWordSizefor1Typo: 4,
    minWordSizefor2Typos: 8,
    disableTypoToleranceOnAttributes: ["cuisine"],
    queryType: "prefixLast",
    hitsPerPage: 20,
    replicas: [`virtual(${ratingReplicaName})`],
  };

  console.log("Applying index settings...");
  await client.setSettings({ indexName: INDEX_NAME, indexSettings: settings });

  console.log("Configuring 'Highest rated' virtual replica...");
  await client.setSettings({
    indexName: ratingReplicaName,
    indexSettings: {
      customRanking: ["desc(rating)", "desc(review_count)"],
    },
  });

  console.log("Replacing all objects (atomic reindex)...");
  await client.replaceAllObjects({
    indexName: INDEX_NAME,
    objects: records,
  });

  
  const synonyms = [
    {
      objectID: "syn-bbq",
      type: "synonym",
      synonyms: ["bbq", "barbecue"],
    },
    {
      objectID: "syn-pizza",
      type: "oneWaySynonym",
      input: "pizza",
      synonyms: ["pizzeria"],
    },
    {
      objectID: "syn-hawaiian",
      type: "oneWaySynonym",
      input: "hawaiian",
      synonyms: ["hawaii regional cuisine"],
    },
    {
      objectID: "syn-veggie",
      type: "oneWaySynonym",
      input: "veggie",
      synonyms: ["vegetarian"],
    },
    {
      objectID: "syn-philly",
      type: "oneWaySynonym",
      input: "philly",
      synonyms: ["philadelphia"],
    },
    {
      objectID: "syn-churrascaria",
      type: "oneWaySynonym",
      input: "churrascaria",
      synonyms: ["brazilian steakhouse"],
    },
    {
      objectID: "syn-soul-food",
      type: "oneWaySynonym",
      input: "soul food",
      synonyms: ["southern"],
    },
  ];

  console.log("Saving synonyms...");
  await client.saveSynonyms({
    indexName: INDEX_NAME,
    synonymHit: synonyms,
    replaceExistingSynonyms: true,
  });

  console.log(`Done. Indexed ${records.length} records into "${INDEX_NAME}".`);
  console.log(`Virtual replica ready: "${ratingReplicaName}".`);
  console.log(`Saved ${synonyms.length} synonyms.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
