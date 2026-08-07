"use strict";

const CHARACTER_COMPOSITION_CHUNK_MODULO = 64;
const CHARACTER_COMPOSITION_ROOT = (() => {
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(
      portable
         ? "../data/generated/character-composition/"
         : "data/generated/character-composition/",
      document.baseURI,
   ).href;
})();
const characterCompositionCache = new Map();
const characterCompositionChunkCache = new Map();
const characterCompositionChunkPending = new Map();
let characterCompositionManifestPending = null;
let characterCompositionUnavailable = false;

function compositionChunkKey(character) {
   return ((character.codePointAt(0) || 0) % CHARACTER_COMPOSITION_CHUNK_MODULO)
      .toString(16)
      .padStart(2, "0");
}

function compositionCharacters(values) {
   return Array.from(
      new Set(
         (Array.isArray(values) ? values : [values])
            .flatMap((value) => Array.from(String(value || "").normalize("NFC")))
            .filter((character) => /^\p{Script=Han}$/u.test(character)),
      ),
   );
}

async function loadCharacterCompositionManifest() {
   if (characterCompositionUnavailable) return null;
   if (characterCompositionManifestPending) return characterCompositionManifestPending;
   characterCompositionManifestPending = fetch(
      new URL("manifest.json", CHARACTER_COMPOSITION_ROOT).href,
      { cache: "default" },
   )
      .then(async (response) => {
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const manifest = await response.json();
         if (
            manifest?.format !== "mo-studio-character-composition" ||
            manifest.schemaVersion !== 1 ||
            manifest.chunkModulo !== CHARACTER_COMPOSITION_CHUNK_MODULO
         ) throw new Error("Manifest de composition incompatible");
         return Object.freeze(manifest);
      })
      .catch(() => {
         characterCompositionUnavailable = true;
         return null;
      });
   return characterCompositionManifestPending;
}

function normalizeCompositionRecord(character, raw) {
   if (!raw || raw.character !== character || !raw.radical) return null;
   const hasIdentifiedComponent = (node) => {
      if (!node || node.u === true) return false;
      if (typeof node.c === "string") return node.c !== "？";
      return Array.isArray(node.c) && node.c.some(hasIdentifiedComponent);
   };
   const hasUsableComposition = hasIdentifiedComponent(raw.tree);
   const etymology = raw.etymology && typeof raw.etymology === "object"
      ? raw.etymology
      : null;
   const hasOriginHint = typeof etymology?.hint === "string" && etymology.hint.trim();
   if (!hasUsableComposition && !hasOriginHint) return null;
   if (
      hasUsableComposition &&
      (!raw.decomposition || raw.decomposition === "？")
   ) return null;
   return Object.freeze({
      character,
      decomposition: raw.decomposition,
      tree: hasUsableComposition ? raw.tree : null,
      radical: raw.radical,
      components: raw.components && typeof raw.components === "object" ? raw.components : {},
      etymology,
      sourceLine: Number.isInteger(raw.sourceLine) ? raw.sourceLine : null,
   });
}

async function loadCharacterCompositionChunk(key, manifest) {
   if (characterCompositionChunkCache.has(key)) return characterCompositionChunkCache.get(key);
   if (characterCompositionChunkPending.has(key)) return characterCompositionChunkPending.get(key);
   const declared = manifest.chunks.find((chunk) => chunk.key === key);
   if (!declared) return {};
   const request = fetch(new URL(declared.path, CHARACTER_COMPOSITION_ROOT).href, {
      cache: "default",
   })
      .then(async (response) => {
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const chunk = await response.json();
         if (!chunk || typeof chunk !== "object" || Array.isArray(chunk))
            throw new Error("Chunk de composition invalide");
         characterCompositionChunkCache.set(key, chunk);
         return chunk;
      })
      .catch(() => ({}))
      .finally(() => characterCompositionChunkPending.delete(key));
   characterCompositionChunkPending.set(key, request);
   return request;
}

async function loadCharacterCompositions(values) {
   const characters = compositionCharacters(values);
   const result = new Map();
   const unresolved = characters.filter((character) => {
      if (!characterCompositionCache.has(character)) return true;
      result.set(character, characterCompositionCache.get(character));
      return false;
   });
   if (!unresolved.length) return result;
   const manifest = await loadCharacterCompositionManifest();
   if (!manifest) {
      unresolved.forEach((character) => {
         characterCompositionCache.set(character, null);
         result.set(character, null);
      });
      return result;
   }

   const charactersByChunk = new Map();
   unresolved.forEach((character) => {
      const key = compositionChunkKey(character);
      if (!charactersByChunk.has(key)) charactersByChunk.set(key, []);
      charactersByChunk.get(key).push(character);
   });
   await Promise.all(
      Array.from(charactersByChunk, async ([key, chunkCharacters]) => {
         const chunk = await loadCharacterCompositionChunk(key, manifest);
         chunkCharacters.forEach((character) => {
            const record = normalizeCompositionRecord(character, chunk[character]);
            characterCompositionCache.set(character, record);
            result.set(character, record);
         });
      }),
   );
   return result;
}

function preloadCharacterCompositions(values) {
   return loadCharacterCompositions(values).catch(() => new Map());
}
