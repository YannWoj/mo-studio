"use strict";

const CHARACTER_RADICALS_ROOT = (() => {
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(
      portable ? "../data/generated/character-radicals/" : "data/generated/character-radicals/",
      document.baseURI,
   ).href;
})();

const radicalChunkCache = new Map();
const radicalChunkPending = new Map();
let radicalsManifestPending = null;
let radicalsUnavailable = false;

async function loadRadicalsManifest() {
   if (radicalsUnavailable) return null;
   if (radicalsManifestPending) return radicalsManifestPending;
   radicalsManifestPending = fetch(new URL("manifest.json", CHARACTER_RADICALS_ROOT).href, {
      cache: "default",
   })
      .then(async (response) => {
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const manifest = await response.json();
         if (
            manifest?.format !== "mo-studio-character-radicals" ||
            manifest.schemaVersion !== 1 ||
            !Array.isArray(manifest.radicals)
         ) throw new Error("Manifeste des clés incompatible");
         return Object.freeze(manifest);
      })
      .catch(() => {
         radicalsUnavailable = true;
         return null;
      });
   return radicalsManifestPending;
}

async function loadRadicalCatalog() {
   const manifest = await loadRadicalsManifest();
   return manifest ? manifest.radicals : [];
}

async function loadRadicalCharacters(radical) {
   if (radicalChunkCache.has(radical)) return radicalChunkCache.get(radical);
   if (radicalChunkPending.has(radical)) return radicalChunkPending.get(radical);
   const request = (async () => {
      const manifest = await loadRadicalsManifest();
      const declared = manifest && manifest.radicals.find((row) => row.radical === radical);
      if (!declared) return { radical, characters: [] };
      try {
         const response = await fetch(new URL(declared.path, CHARACTER_RADICALS_ROOT).href, {
            cache: "default",
         });
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const chunk = await response.json();
         if (!chunk || chunk.radical !== radical || !Array.isArray(chunk.characters))
            throw new Error("Chunk de clé invalide");
         const frozen = Object.freeze({ radical, characters: Object.freeze(chunk.characters) });
         radicalChunkCache.set(radical, frozen);
         return frozen;
      } catch (error) {
         return { radical, characters: [] };
      }
   })().finally(() => radicalChunkPending.delete(radical));
   radicalChunkPending.set(radical, request);
   return request;
}
