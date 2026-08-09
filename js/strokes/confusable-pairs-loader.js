"use strict";

const CONFUSABLE_PAIRS_CHUNK_MODULO = 64;
const CONFUSABLE_PAIRS_ROOT = (() => {
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(
      portable
         ? "../data/generated/confusable-pairs/"
         : "data/generated/confusable-pairs/",
      document.baseURI,
   ).href;
})();
const confusablePairsCache = new Map();
const confusablePairsChunkCache = new Map();
const confusablePairsChunkPending = new Map();
let confusablePairsManifestPending = null;
let confusablePairsUnavailable = false;

function confusablePairsChunkKey(character) {
   return ((character.codePointAt(0) || 0) % CONFUSABLE_PAIRS_CHUNK_MODULO)
      .toString(16)
      .padStart(2, "0");
}

function confusablePairsCharacters(values) {
   return Array.from(
      new Set(
         (Array.isArray(values) ? values : [values])
            .flatMap((value) => Array.from(String(value || "").normalize("NFC")))
            .filter((character) => /^\p{Script=Han}$/u.test(character)),
      ),
   );
}

async function loadConfusablePairsManifest() {
   if (confusablePairsUnavailable) return null;
   if (confusablePairsManifestPending) return confusablePairsManifestPending;
   confusablePairsManifestPending = fetch(
      new URL("manifest.json", CONFUSABLE_PAIRS_ROOT).href,
      { cache: "default" },
   )
      .then(async (response) => {
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const manifest = await response.json();
         if (
            manifest?.format !== "mo-studio-confusable-pairs" ||
            manifest.schemaVersion !== 1 ||
            manifest.chunkModulo !== CONFUSABLE_PAIRS_CHUNK_MODULO
         ) throw new Error("Manifest de paires confusables incompatible");
         return Object.freeze(manifest);
      })
      .catch(() => {
         confusablePairsUnavailable = true;
         return null;
      });
   return confusablePairsManifestPending;
}

function normalizeConfusablePairsRecord(character, rawPartners) {
   if (!Array.isArray(rawPartners) || !rawPartners.length) return null;
   const partners = rawPartners
      .filter((partner) => partner && typeof partner.character === "string")
      .map((partner) =>
         Object.freeze({
            character: partner.character,
            structural: partner.structural === true,
            geometricScore: typeof partner.geometricScore === "number" ? partner.geometricScore : null,
            activeTier: partner.activeTier === true,
            diffStrokeIndex: Number.isInteger(partner.diffStrokeIndex) ? partner.diffStrokeIndex : null,
         }),
      );
   if (!partners.length) return null;
   return Object.freeze({ character, partners: Object.freeze(partners) });
}

async function loadConfusablePairsChunk(key, manifest) {
   if (confusablePairsChunkCache.has(key)) return confusablePairsChunkCache.get(key);
   if (confusablePairsChunkPending.has(key)) return confusablePairsChunkPending.get(key);
   const declared = manifest.chunks.find((chunk) => chunk.key === key);
   if (!declared) return {};
   const request = fetch(new URL(declared.path, CONFUSABLE_PAIRS_ROOT).href, {
      cache: "default",
   })
      .then(async (response) => {
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const chunk = await response.json();
         if (!chunk || typeof chunk !== "object" || Array.isArray(chunk))
            throw new Error("Chunk de paires confusables invalide");
         confusablePairsChunkCache.set(key, chunk);
         return chunk;
      })
      .catch(() => ({}))
      .finally(() => confusablePairsChunkPending.delete(key));
   confusablePairsChunkPending.set(key, request);
   return request;
}

async function loadConfusablePairs(values) {
   const characters = confusablePairsCharacters(values);
   const result = new Map();
   const unresolved = characters.filter((character) => {
      if (!confusablePairsCache.has(character)) return true;
      result.set(character, confusablePairsCache.get(character));
      return false;
   });
   if (!unresolved.length) return result;
   const manifest = await loadConfusablePairsManifest();
   if (!manifest) {
      unresolved.forEach((character) => {
         confusablePairsCache.set(character, null);
         result.set(character, null);
      });
      return result;
   }

   const charactersByChunk = new Map();
   unresolved.forEach((character) => {
      const key = confusablePairsChunkKey(character);
      if (!charactersByChunk.has(key)) charactersByChunk.set(key, []);
      charactersByChunk.get(key).push(character);
   });
   await Promise.all(
      Array.from(charactersByChunk, async ([key, chunkCharacters]) => {
         const chunk = await loadConfusablePairsChunk(key, manifest);
         chunkCharacters.forEach((character) => {
            const record = normalizeConfusablePairsRecord(character, chunk[character]);
            confusablePairsCache.set(character, record);
            result.set(character, record);
         });
      }),
   );
   return result;
}

function preloadConfusablePairs(values) {
   return loadConfusablePairs(values).catch(() => new Map());
}

// Lecture synchrone du cache déjà chargé (préchargé par preloadConfusablePairs),
// pour les points d'appel qui ne peuvent pas attendre une promesse — notamment le
// gestionnaire de notation en révision. undefined = pas encore chargé (à traiter
// comme non éligible, jamais comme "pas de partenaire") ; null = confirmé sans
// partenaire ; sinon l'enregistrement.
function confusablePairsCached(character) {
   return confusablePairsCache.has(character) ? confusablePairsCache.get(character) : undefined;
}
