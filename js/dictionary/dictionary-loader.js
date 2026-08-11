"use strict";

const DICTIONARY_SCHEMA_VERSION = 5;
const DICTIONARY_CACHE_NAME = "mo-studio-dictionary-v3";
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
   manifestPending: null,
   manifestEpoch: 0,
   manifestOfflineFallback: false,
   attribution: null,
   locations: null,
   referenceById: null,
   indexes: new Map(),
   chunks: new Map(),
   previewCatalog: null,
   entries: new Map(),
   error: null,
};

function dictionaryResourceUrl(relativePath, buildId) {
   const url = new URL(relativePath, DICTIONARY_ROOT);
   if (buildId) url.searchParams.set("build", buildId);
   return url.href;
}

async function openDictionaryCache() {
   return "caches" in globalThis ? caches.open(DICTIONARY_CACHE_NAME) : null;
}

class StaleDictionaryGenerationError extends Error {
   constructor() {
      super("La génération du dictionnaire a changé pendant le chargement.");
      this.name = "StaleDictionaryGenerationError";
   }
}

function dictionaryFileDescriptor(manifest, relativePath) {
   const descriptor = manifest.files.find((item) => item.path === relativePath);
   if (!descriptor) throw new Error(relativePath + " · empreinte absente du manifeste");
   return descriptor;
}

function ensureDictionaryGeneration(manifest) {
   if (!manifest || dictionaryDataState.manifest?.buildId !== manifest.buildId)
      throw new StaleDictionaryGenerationError();
}

async function dictionarySha256(buffer) {
   if (!globalThis.crypto?.subtle)
      throw new Error("Vérification d’intégrité SHA-256 indisponible dans ce navigateur.");
   const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
   return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyDictionaryResponse(response, descriptor, relativePath) {
   const bytes = await response.arrayBuffer();
   if (bytes.byteLength !== descriptor.sizeBytes)
      throw new Error(relativePath + " · taille différente du manifeste");
   if (await dictionarySha256(bytes) !== descriptor.sha256)
      throw new Error(relativePath + " · empreinte SHA-256 différente du manifeste");
   return new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
   });
}

async function fetchDictionaryNetworkResponse(relativePath, url, reload, descriptor) {
   const response = await fetch(url, { cache: reload ? "reload" : "default" });
   if (!response.ok) throw new Error(relativePath + " · HTTP " + response.status);
   try {
      return await verifyDictionaryResponse(response, descriptor, relativePath);
   } catch (error) {
      if (reload) throw error;
      const refreshed = await fetch(url, { cache: "reload" });
      if (!refreshed.ok) throw new Error(relativePath + " · HTTP " + refreshed.status);
      return verifyDictionaryResponse(refreshed, descriptor, relativePath);
   }
}

async function fetchDictionaryResponse(relativePath, reload, manifest) {
   ensureDictionaryGeneration(manifest);
   const descriptor = dictionaryFileDescriptor(manifest, relativePath);
   const url = dictionaryResourceUrl(relativePath, manifest.buildId);
   const cache = await openDictionaryCache();
   if (!reload && cache) {
      const cached = await cache.match(url);
      if (cached) {
         try {
            const response = await verifyDictionaryResponse(cached, descriptor, relativePath);
            ensureDictionaryGeneration(manifest);
            return { response, cached: true, cache, url };
         } catch (error) {
            await cache.delete(url);
         }
      }
      // Migration path for a dictionary prepared by the pre-buildId loader.
      // It is safe only when the manifest itself came from the offline cache.
      if (dictionaryDataState.manifestOfflineFallback) {
         const legacyUrl = dictionaryResourceUrl(relativePath);
         const legacy = await cache.match(legacyUrl);
         if (legacy) {
            try {
               const response = await verifyDictionaryResponse(legacy, descriptor, relativePath);
               ensureDictionaryGeneration(manifest);
               await cache.put(url, response.clone());
               return { response, cached: true, cache, url };
            } catch (error) {
               await cache.delete(legacyUrl);
            }
         }
      }
   }
   const response = await fetchDictionaryNetworkResponse(relativePath, url, !!reload, descriptor);
   ensureDictionaryGeneration(manifest);
   if (cache) await cache.put(url, response.clone());
   return { response, cached: false, cache, url };
}

async function fetchDictionaryJson(relativePath, reload, manifest) {
   const loaded = await fetchDictionaryResponse(relativePath, !!reload, manifest);
   try {
      return await loaded.response.json();
   } catch (error) {
      if (loaded.cached && loaded.cache) await loaded.cache.delete(loaded.url);
      throw new Error(relativePath + " · JSON corrompu");
   }
}

function validateDictionaryManifest(manifest) {
   if (
      !manifest ||
      manifest.format !== "mo-studio-offline-dictionary" ||
      manifest.schemaVersion !== DICTIONARY_SCHEMA_VERSION ||
      typeof manifest.buildId !== "string" ||
      !/^[0-9a-f]{64}$/u.test(manifest.buildId) ||
      !manifest.indexes ||
      !manifest.entryLocations ||
      !manifest.attribution ||
      !manifest.chunkPathTemplate ||
      !manifest.searchPreviews ||
      !Array.isArray(manifest.files) ||
      !Array.isArray(manifest.chunks)
   )
      throw new Error("Version d’index absente, corrompue ou incompatible.");
   const paths = new Set();
   manifest.files.forEach((descriptor) => {
      if (
         !descriptor || typeof descriptor.path !== "string" || paths.has(descriptor.path) ||
         !Number.isInteger(descriptor.sizeBytes) || descriptor.sizeBytes < 0 ||
         typeof descriptor.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(descriptor.sha256)
      ) throw new Error("Table d’empreintes du dictionnaire invalide.");
      paths.add(descriptor.path);
   });
   const requiredPaths = [
      manifest.entryLocations,
      manifest.attribution,
      manifest.searchPreviews,
      ...Object.values(manifest.indexes),
      ...manifest.chunks.map((chunk) => chunk.path),
   ];
   if (requiredPaths.some((path) => !paths.has(path)))
      throw new Error("Ressource du dictionnaire absente de la table d’empreintes.");
   return manifest;
}

function resetDictionaryMemory() {
   dictionaryDataState.manifestEpoch++;
   if (typeof clearDictionarySearchCache === "function")
      clearDictionarySearchCache();
   if (typeof resetDictionarySearchWorker === "function")
      resetDictionarySearchWorker();
   dictionaryDataState.manifest = null;
   dictionaryDataState.manifestPending = null;
   dictionaryDataState.manifestOfflineFallback = false;
   dictionaryDataState.attribution = null;
   dictionaryDataState.locations = null;
   dictionaryDataState.referenceById = null;
   dictionaryDataState.indexes.clear();
   dictionaryDataState.chunks.clear();
   dictionaryDataState.previewCatalog = null;
   dictionaryDataState.entries.clear();
   dictionaryDataState.error = null;
   dictionaryDataState.status = "idle";
   if (typeof resetCharacterRadicalsMemory === "function") resetCharacterRadicalsMemory();
}

async function fetchCurrentDictionaryManifest(reload) {
   const url = dictionaryResourceUrl("manifest.json");
   const cache = await openDictionaryCache();
   let networkError = null;
   try {
      const response = await fetch(url, { cache: reload ? "reload" : "no-cache" });
      if (!response.ok) throw new Error("manifest.json · HTTP " + response.status);
      const manifest = validateDictionaryManifest(await response.clone().json());
      if (cache) await cache.put(url, response.clone());
      return { manifest, offlineFallback: false };
   } catch (error) {
      networkError = error;
   }
   if (!reload && cache) {
      const cached = await cache.match(url);
      if (cached) {
         try {
            return {
               manifest: validateDictionaryManifest(await cached.json()),
               offlineFallback: true,
            };
         } catch (error) {
            await cache.delete(url);
         }
      }
   }
   throw networkError || new Error("manifest.json · indisponible");
}

async function loadDictionaryManifest(reload) {
   if (dictionaryDataState.manifest && !reload) return dictionaryDataState.manifest;
   if (dictionaryDataState.manifestPending && !reload)
      return dictionaryDataState.manifestPending;
   dictionaryDataState.status = "loading";
   const epoch = ++dictionaryDataState.manifestEpoch;
   const request = (async () => {
      try {
         const previousBuildId = dictionaryDataState.manifest?.buildId || null;
         const loaded = await fetchCurrentDictionaryManifest(!!reload);
         const manifest = loaded.manifest;
         if (epoch !== dictionaryDataState.manifestEpoch)
            throw new StaleDictionaryGenerationError();
          if (previousBuildId && previousBuildId !== manifest.buildId) {
            dictionaryDataState.attribution = null;
            dictionaryDataState.locations = null;
            dictionaryDataState.referenceById = null;
            dictionaryDataState.indexes.clear();
            dictionaryDataState.chunks.clear();
             dictionaryDataState.previewCatalog = null;
             dictionaryDataState.entries.clear();
             if (typeof resetCharacterRadicalsMemory === "function")
                resetCharacterRadicalsMemory();
          }
         dictionaryDataState.manifest = manifest;
         dictionaryDataState.manifestOfflineFallback = loaded.offlineFallback;
         dictionaryDataState.status = "ready";
         return manifest;
       } catch (error) {
          if (epoch === dictionaryDataState.manifestEpoch) {
             dictionaryDataState.status = "error";
             dictionaryDataState.error = error;
          }
          throw error;
      }
   })();
   dictionaryDataState.manifestPending = request;
   try {
      return await request;
   } finally {
      if (dictionaryDataState.manifestPending === request)
         dictionaryDataState.manifestPending = null;
   }
}

async function loadDictionaryAttribution(reload, expectedManifest) {
   const manifest = expectedManifest || await loadDictionaryManifest(reload);
   ensureDictionaryGeneration(manifest);
   if (dictionaryDataState.attribution && !reload)
      return { manifest, attribution: dictionaryDataState.attribution };
   const attribution = await fetchDictionaryJson(manifest.attribution, !!reload, manifest);
   if (!Array.isArray(attribution.sources))
      throw new Error("Attribution du dictionnaire invalide.");
   ensureDictionaryGeneration(manifest);
   dictionaryDataState.attribution = attribution;
   return { manifest, attribution };
}

async function loadDictionaryLocations(reload, expectedManifest) {
   const manifest = expectedManifest || await loadDictionaryManifest(reload);
   ensureDictionaryGeneration(manifest);
   if (dictionaryDataState.locations && !reload) return dictionaryDataState.locations;
   const locations = await fetchDictionaryJson(manifest.entryLocations, !!reload, manifest);
   if (!Array.isArray(locations) || locations.length !== manifest.counts.entries)
      throw new Error("Table des entrées du dictionnaire invalide.");
   ensureDictionaryGeneration(manifest);
   dictionaryDataState.locations = locations;
   dictionaryDataState.referenceById = null;
   return locations;
}

async function loadDictionaryIndex(name, reload, expectedManifest) {
   const manifest = expectedManifest || await loadDictionaryManifest(reload);
   ensureDictionaryGeneration(manifest);
   const path = manifest.indexes[name];
   if (!path) throw new Error("Index inconnu : " + name);
   if (dictionaryDataState.indexes.has(name) && !reload)
      return dictionaryDataState.indexes.get(name);
   const index = await fetchDictionaryJson(path, !!reload, manifest);
   if (!index || typeof index !== "object" || Array.isArray(index))
      throw new Error(path + " · contenu invalide");
   ensureDictionaryGeneration(manifest);
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

async function loadDictionaryChunk(key, reload, expectedManifest) {
   const manifest = expectedManifest || await loadDictionaryManifest(reload);
   ensureDictionaryGeneration(manifest);
   if (dictionaryDataState.chunks.has(key) && !reload) {
      const entries = dictionaryDataState.chunks.get(key);
      rememberDictionaryChunk(key, entries);
      return entries;
   }
   const path = manifest.chunkPathTemplate.replace("{chunk}", key);
   const payload = await fetchDictionaryJson(path, !!reload, manifest);
   if (
      !payload ||
      payload.schemaVersion !== DICTIONARY_SCHEMA_VERSION ||
      !Array.isArray(payload.entries)
   )
      throw new Error(path + " · chunk invalide");
   ensureDictionaryGeneration(manifest);
   rememberDictionaryChunk(key, payload.entries);
   return payload.entries;
}

function dictionaryPreviewFromArray(value, reference) {
   if (!Array.isArray(value) || value.length !== 12)
      throw new Error("Aperçu de dictionnaire invalide.");
   const readings = (value[11] || []).map((reading) => ({
      pinyin: {
         marked: reading[0],
         numbered: reading[1],
         plain: reading[2],
      },
      definitionsFr: Array.isArray(reading[3]) ? reading[3].slice() : [],
      definitionsEn: Array.isArray(reading[4]) ? reading[4].slice() : [],
      frenchStatus: reading[5] || (reading[3]?.length ? "source" : "unavailable"),
   }));
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
      frenchStatus: readings[0]?.frenchStatus || (value[5] ? "source" : "unavailable"),
      frenchProvenance: [],
      readings,
      hskLegacy: value[8] || [],
      hsk30: value[9] || [],
      frequencyRank: value[10],
      characters: Array.from(value[1]).filter((character) => HAN_PATTERN.test(character)),
      __preview: true,
      __reference: reference,
   };
}

async function loadDictionaryPreviewCatalog(reload, expectedManifest) {
   const manifest = expectedManifest || await loadDictionaryManifest(reload);
   ensureDictionaryGeneration(manifest);
   if (dictionaryDataState.previewCatalog && !reload) return dictionaryDataState.previewCatalog;
   const payload = await fetchDictionaryJson(manifest.searchPreviews, !!reload, manifest);
   if (
      !payload ||
      payload.schemaVersion !== DICTIONARY_SCHEMA_VERSION ||
      !Array.isArray(payload.entries) ||
      payload.entries.length !== manifest.counts.entries
   )
      throw new Error(manifest.searchPreviews + " · aperçus invalides");
   ensureDictionaryGeneration(manifest);
   dictionaryDataState.previewCatalog = payload.entries;
   return payload.entries;
}

async function loadDictionaryPreviewsByReferences(references, options) {
   const reload = !!(options && options.reload);
   const manifest = options?.manifest || await loadDictionaryManifest(reload);
   const locations = await loadDictionaryLocations(reload, manifest);
   const catalog = await loadDictionaryPreviewCatalog(reload, manifest);
   ensureDictionaryGeneration(manifest);
   const uniqueReferences = Array.from(new Set(references)).filter(
      (reference) => Number.isInteger(reference) && reference >= 0 && reference < locations.length,
   );
   return uniqueReferences
      .map((reference) => dictionaryPreviewFromArray(catalog[reference], reference))
      .filter(Boolean);
}

async function loadDictionaryEntriesByReferences(references, options) {
   const reload = !!(options && options.reload);
   const manifest = options?.manifest || await loadDictionaryManifest(reload);
   const locations = await loadDictionaryLocations(reload, manifest);
   ensureDictionaryGeneration(manifest);
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
         batch.map(async ([chunk, wanted]) => [
            chunk,
            wanted,
            await loadDictionaryChunk(chunk, reload, manifest),
         ]),
      );
      ensureDictionaryGeneration(manifest);
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
   const manifest = await loadDictionaryManifest(false);
   ensureDictionaryGeneration(manifest);
   if (dictionaryDataState.entries.has(entryId))
      return dictionaryDataState.entries.get(entryId);
   const locations = await loadDictionaryLocations(false, manifest);
   if (!dictionaryDataState.referenceById) {
      dictionaryDataState.referenceById = new Map(
         locations.map(([id], reference) => [id, reference]),
      );
   }
   const reference = dictionaryDataState.referenceById.get(entryId);
   if (reference == null) return null;
   const [entry] = await loadDictionaryEntriesByReferences([reference], { manifest });
   return entry || null;
}

async function loadDictionaryCharacterLinks(character, limit) {
   const manifest = await loadDictionaryManifest(false);
   const index = await loadDictionaryIndex("characters", false, manifest);
   const item = index[character];
   if (!item) return { characterEntry: null, words: [] };
   const references = [item.entryRef, ...item.wordRefs.slice(0, limit || 12)];
   const entries = await loadDictionaryPreviewsByReferences(references, { manifest });
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
         if (tasks[index][0] === "positions") await loadDictionaryLocations(true, manifest);
         else if (tasks[index][0] === "previews") await loadDictionaryPreviewCatalog(true, manifest);
         else await loadDictionaryIndex(tasks[index][0], true, manifest);
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
               .map((chunk) => fetchDictionaryResponse(chunk.path, true, manifest)),
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
