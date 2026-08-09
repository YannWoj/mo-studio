"use strict";

let hsk1RootHanziSet = null;
let hsk1RootPending = null;

function hsk1RootUrl() {
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(portable ? "../hsk1.json" : "hsk1.json", document.baseURI).href;
}

async function loadHsk1RootHanziSet() {
   if (hsk1RootHanziSet) return hsk1RootHanziSet;
   if (hsk1RootPending) return hsk1RootPending;
   hsk1RootPending = fetch(hsk1RootUrl(), { cache: "default" })
      .then((response) => {
         if (!response.ok) throw new Error("HTTP " + response.status);
         return response.json();
      })
      .then((data) => {
         const cards = Array.isArray(data?.cards) ? data.cards : [];
         hsk1RootHanziSet = new Set(cards.map((card) => String(card?.hz || "").trim()).filter(Boolean));
         return hsk1RootHanziSet;
      })
      .catch(() => {
         hsk1RootHanziSet = new Set();
         return hsk1RootHanziSet;
      })
      .finally(() => {
         hsk1RootPending = null;
      });
   return hsk1RootPending;
}
