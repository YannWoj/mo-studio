"use strict";

const DICTIONARY_SCHEMA_VERSION = 1;
const DICTIONARY_CACHE_NAME = "mo-studio-dictionary-v1";
const DICTIONARY_PARSED_CHUNK_LIMIT = 10;
const DICTIONARY_ENTRY_CACHE_LIMIT = 240;
const DICTIONARY_ROOT = (() => {
   if (typeof document === "undefined") {
      const workerBase = typeof self !== "undefined" && self.location
         ? self.location.href
         : "http://localhost/js/search/dictionary-search-worker.js";
      return new URL("../../data/generated/dictionary/", workerBase).href;
   }
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(portable ? "../data/generated/dictionary/" : "data/generated/dictionary/", document.baseURI).href;
})();

const dictionaryDataState = {
   status: "idle",
   manifest: null,
   attribution: null,
   locations: null,
   referenceById: null,
   indexes: new Map(),
   chunks: new Map(),
   previewCatalog: null,
   entries: new Map(),
   error: null,
};

function dictionaryResourceUrl(relativePath) {
   return new URL(relativePath, DICTIONARY_ROOT).href;
}

async function openDictionaryCache() {
   return "caches" in globalThis ? caches.open(DICTIONARY_CACHE_NAME) : null;
}

async function fetchDictionaryResponse(relativePath, reload) {
   const url = dictionaryResourceUrl(relativePath);
   const cache = await openDictionaryCache();
   if (!reload && cache) {
      const cached = await cache.match(url);
      if (cached) return { response: cached, cached: true, cache, url };
   }
   const response = await fetch(url, { cache: reload ? "reload" : "default" });
   if (!response.ok) throw new Error(relativePath + " · HTTP " + response.status);
   if (cache) {
      const write = cache.put(url, response.clone());
      if (reload) await write;
      else write.catch(() => {});
   }
   return { response, cached: false, cache, url };
}

async function fetchDictionaryJson(relativePath, reload) {
   let loaded = await fetchDictionaryResponse(relativePath, !!reload);
   try {
      return await loaded.response.json();
   } catch (error) {
      if (loaded.cached && loaded.cache) {
         await loaded.cache.delete(loaded.url);
         loaded = await fetchDictionaryResponse(relativePath, true);
         try {
            return await loaded.response.json();
         } catch (networkError) {
            throw new Error(relativePath + " · JSON corrompu");
         }
      }
      throw new Error(relativePath + " · JSON corrompu");
   }
}

function validateDictionaryManifest(manifest) {
   if (
      !manifest ||
      manifest.format !== "mo-studio-offline-dictionary" ||
      manifest.schemaVersion !== DICTIONARY_SCHEMA_VERSION ||
      !manifest.indexes ||
      !manifest.entryLocations ||
      !manifest.attribution ||
      !manifest.chunkPathTemplate ||
      !manifest.searchPreviews
   )
      throw new Error("Version d’index absente, corrompue ou incompatible.");
   return manifest;
}

function resetDictionaryMemory() {
   if (typeof clearDictionarySearchCache === "function")
      clearDictionarySearchCache();
   if (typeof resetDictionarySearchWorker === "function")
      resetDictionarySearchWorker();
   dictionaryDataState.manifest = null;
   dictionaryDataState.attribution = null;
   dictionaryDataState.locations = null;
   dictionaryDataState.referenceById = null;
   dictionaryDataState.indexes.clear();
   dictionaryDataState.chunks.clear();
   dictionaryDataState.previewCatalog = null;
   dictionaryDataState.entries.clear();
   dictionaryDataState.error = null;
   dictionaryDataState.status = "idle";
}

async function loadDictionaryManifest(reload) {
   if (dictionaryDataState.manifest && !reload) return dictionaryDataState.manifest;
   dictionaryDataState.status = "loading";
   try {
      const manifest = validateDictionaryManifest(
         await fetchDictionaryJson("manifest.json", !!reload),
      );
      if (
         dictionaryDataState.manifest &&
         dictionaryDataState.manifest.buildId !== manifest.buildId
      ) {
         dictionaryDataState.locations = null;
         dictionaryDataState.referenceById = null;
         dictionaryDataState.indexes.clear();
         dictionaryDataState.chunks.clear();
         dictionaryDataState.previewCatalog = null;
         dictionaryDataState.entries.clear();
      }
      dictionaryDataState.manifest = manifest;
      dictionaryDataState.status = "ready";
      return manifest;
   } catch (error) {
      dictionaryDataState.status = "error";
      dictionaryDataState.error = error;
      throw error;
   }
}

async function loadDictionaryAttribution(reload) {
   const manifest = await loadDictionaryManifest(reload);
   if (dictionaryDataState.attribution && !reload)
      return { manifest, attribution: dictionaryDataState.attribution };
   const attribution = await fetchDictionaryJson(manifest.attribution, !!reload);
   if (!Array.isArray(attribution.sources))
      throw new Error("Attribution du dictionnaire invalide.");
   dictionaryDataState.attribution = attribution;
   return { manifest, attribution };
}

async function loadDictionaryLocations(reload) {
   const manifest = await loadDictionaryManifest(reload);
   if (dictionaryDataState.locations && !reload) return dictionaryDataState.locations;
   const locations = await fetchDictionaryJson(manifest.entryLocations, !!reload);
   if (!Array.isArray(locations) || locations.length !== manifest.counts.entries)
      throw new Error("Table des entrées du dictionnaire invalide.");
   dictionaryDataState.locations = locations;
   dictionaryDataState.referenceById = null;
   return locations;
}

async function loadDictionaryIndex(name, reload) {
   const manifest = await loadDictionaryManifest(reload);
   const path = manifest.indexes[name];
   if (!path) throw new Error("Index inconnu : " + name);
   if (dictionaryDataState.indexes.has(name) && !reload)
      return dictionaryDataState.indexes.get(name);
   const index = await fetchDictionaryJson(path, !!reload);
   if (!index || typeof index !== "object" || Array.isArray(index))
      throw new Error(path + " · contenu invalide");
   dictionaryDataState.indexes.set(name, index);
   return index;
}

function rememberDictionaryEntry(entry) {
   dictionaryDataState.entries.delete(entry.id);
   dictionaryDataState.entries.set(entry.id, entry);
   while (dictionaryDataState.entries.size > DICTIONARY_ENTRY_CACHE_LIMIT) {
      const oldest = dictionaryDataState.entries.keys().next().value;
      dictionaryDataState.entries.delete(oldest);
   }
}

function rememberDictionaryChunk(key, entries) {
   dictionaryDataState.chunks.delete(key);
   dictionaryDataState.chunks.set(key, entries);
   while (dictionaryDataState.chunks.size > DICTIONARY_PARSED_CHUNK_LIMIT) {
      const oldest = dictionaryDataState.chunks.keys().next().value;
      dictionaryDataState.chunks.delete(oldest);
   }
}

async function loadDictionaryChunk(key, reload) {
   if (dictionaryDataState.chunks.has(key) && !reload) {
      const entries = dictionaryDataState.chunks.get(key);
      rememberDictionaryChunk(key, entries);
      return entries;
   }
   const manifest = await loadDictionaryManifest(reload);
   const path = manifest.chunkPathTemplate.replace("{chunk}", key);
   const payload = await fetchDictionaryJson(path, !!reload);
   if (
      !payload ||
      payload.schemaVersion !== DICTIONARY_SCHEMA_VERSION ||
      !Array.isArray(payload.entries)
   )
      throw new Error(path + " · chunk invalide");
   rememberDictionaryChunk(key, payload.entries);
   return payload.entries;
}

function dictionaryPreviewFromArray(value, reference) {
   if (!Array.isArray(value) || value.length !== 11)
      throw new Error("Aperçu de dictionnaire invalide.");
   return {
      id: value[0],
      simplified: value[1],
      traditional: value[2] || value[1],
      entryType: value[3] === "c" ? "character" : "word",
      pinyin: (value[4] || []).map((variant) => ({
         marked: variant[0],
         numbered: variant[1],
         plain: variant[2],
      })),
      definitionsFr: value[5] ? [value[5]] : [],
      definitionsEn: value[6] ? [value[6]] : [],
      sources: value[7] || [],
      hskLegacy: value[8] || [],
      hsk30: value[9] || [],
      frequencyRank: value[10],
      characters: Array.from(value[1]).filter((character) => HAN_PATTERN.test(character)),
      __preview: true,
      __reference: reference,
   };
}

async function loadDictionaryPreviewCatalog() {
   if (dictionaryDataState.previewCatalog) return dictionaryDataState.previewCatalog;
   const manifest = await loadDictionaryManifest(false);
   const payload = await fetchDictionaryJson(manifest.searchPreviews, false);
   if (
      !payload ||
      payload.schemaVersion !== DICTIONARY_SCHEMA_VERSION ||
      !Array.isArray(payload.entries) ||
      payload.entries.length !== manifest.counts.entries
   )
      throw new Error(manifest.searchPreviews + " · aperçus invalides");
   dictionaryDataState.previewCatalog = payload.entries;
   return payload.entries;
}

async function loadDictionaryPreviewsByReferences(references) {
   const locations = await loadDictionaryLocations(false);
   const catalog = await loadDictionaryPreviewCatalog();
   const uniqueReferences = Array.from(new Set(references)).filter(
      (reference) => Number.isInteger(reference) && reference >= 0 && reference < locations.length,
   );
   return uniqueReferences
      .map((reference) => dictionaryPreviewFromArray(catalog[reference], reference))
      .filter(Boolean);
}

async function loadDictionaryEntriesByReferences(references, options) {
   const locations = await loadDictionaryLocations(false);
   const reload = !!(options && options.reload);
   const uniqueReferences = Array.from(new Set(references)).filter(
      (reference) => Number.isInteger(reference) && reference >= 0 && reference < locations.length,
   );
   const output = new Map();
   const byChunk = new Map();

   uniqueReferences.forEach((reference) => {
      const [entryId, chunk] = locations[reference];
      const cached = dictionaryDataState.entries.get(entryId);
      if (cached && !reload) {
         output.set(reference, cached);
         return;
      }
      if (!byChunk.has(chunk)) byChunk.set(chunk, []);
      byChunk.get(chunk).push([reference, entryId]);
   });

   const groups = Array.from(byChunk.entries());
   for (let offset = 0; offset < groups.length; offset += 8) {
      const batch = groups.slice(offset, offset + 8);
      const loaded = await Promise.all(
         batch.map(async ([chunk, wanted]) => [chunk, wanted, await loadDictionaryChunk(chunk, reload)]),
      );
      loaded.forEach(([, wanted, entries]) => {
         const wantedById = new Map(wanted.map(([reference, entryId]) => [entryId, reference]));
         entries.forEach((entry) => {
            const reference = wantedById.get(entry.id);
            if (reference == null) return;
            rememberDictionaryEntry(entry);
            output.set(reference, entry);
         });
      });
   }
   return uniqueReferences.map((reference) => output.get(reference)).filter(Boolean);
}

async function loadDictionaryEntryById(entryId) {
   if (dictionaryDataState.entries.has(entryId))
      return dictionaryDataState.entries.get(entryId);
   const locations = await loadDictionaryLocations(false);
   if (!dictionaryDataState.referenceById) {
      dictionaryDataState.referenceById = new Map(
         locations.map(([id], reference) => [id, reference]),
      );
   }
   const reference = dictionaryDataState.referenceById.get(entryId);
   if (reference == null) return null;
   const [entry] = await loadDictionaryEntriesByReferences([reference]);
   return entry || null;
}

async function loadDictionaryCharacterLinks(character, limit) {
   const index = await loadDictionaryIndex("characters", false);
   const item = index[character];
   if (!item) return { characterEntry: null, words: [] };
   const references = [item.entryRef, ...item.wordRefs.slice(0, limit || 12)];
   const entries = await loadDictionaryPreviewsByReferences(references);
   return {
      characterEntry: entries.find((entry) => entry.entryType === "character") || null,
      words: entries.filter((entry) => entry.entryType === "word"),
   };
}

async function deleteDictionaryCacheOnly() {
   if ("caches" in globalThis) await caches.delete(DICTIONARY_CACHE_NAME);
   if ("indexedDB" in globalThis && indexedDB.databases) {
      const databases = await indexedDB.databases();
      if (databases.some((database) => database.name === DICTIONARY_CACHE_NAME)) {
         await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DICTIONARY_CACHE_NAME);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("Le cache du dictionnaire est encore ouvert."));
         });
      }
   }
   resetDictionaryMemory();
}

async function rebuildDictionaryIndex(onStatus) {
   const update = (message) => {
      dictionaryDataState.status = "loading";
      if (onStatus) onStatus("loading", message);
   };
   try {
      update("Nettoyage du cache du dictionnaire…");
      await deleteDictionaryCacheOnly();
      const { manifest } = await loadDictionaryAttribution(true);
      const tasks = [
         ["positions", manifest.entryLocations],
         ["previews", manifest.searchPreviews],
         ...Object.entries(manifest.indexes),
      ];
      for (let index = 0; index < tasks.length; index++) {
         update("Préparation hors ligne " + (index + 1) + " / " + tasks.length + "…");
         if (tasks[index][0] === "positions") await loadDictionaryLocations(true);
         else if (tasks[index][0] === "previews") await loadDictionaryPreviewCatalog();
         else await loadDictionaryIndex(tasks[index][0], true);
      }
      const chunks = manifest.chunks || [];
      for (let offset = 0; offset < chunks.length; offset += 8) {
         update(
            "Préparation des fiches hors ligne " +
               Math.min(offset + 8, chunks.length) +
               " / " +
               chunks.length +
               "…",
         );
         await Promise.all(
            chunks
               .slice(offset, offset + 8)
               .map((chunk) => fetchDictionaryResponse(chunk.path, true)),
         );
      }
      dictionaryDataState.status = "ready";
      if (onStatus)
         onStatus(
            "success",
            "Index prêt hors ligne · " + manifest.counts.words.toLocaleString("fr-FR") + " entrées lexicales.",
         );
      return manifest;
   } catch (error) {
      dictionaryDataState.status = "error";
      dictionaryDataState.error = error;
      if (onStatus) onStatus("error", "Échec · " + error.message);
      throw error;
   }
}
