"use strict";

const CHARACTER_RADICALS_SCHEMA_VERSION = 2;
const CHARACTER_RADICALS_ROOT = (() => {
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(
      portable ? "../data/generated/character-radicals/" : "data/generated/character-radicals/",
      document.baseURI,
   ).href;
})();

const radicalChunkCache = new Map();
const radicalChunkPending = new Map();
let radicalsManifest = null;
let radicalsManifestPending = null;
let radicalsManifestPendingDictionaryBuildId = null;
let radicalsManifestEpoch = 0;

function resetCharacterRadicalsMemory() {
   radicalsManifestEpoch++;
   radicalsManifest = null;
   radicalsManifestPending = null;
   radicalsManifestPendingDictionaryBuildId = null;
   radicalChunkCache.clear();
   radicalChunkPending.clear();
   if (typeof clearRadicalBrowserCache === "function") clearRadicalBrowserCache();
}

function characterRadicalsResourceUrl(relativePath, buildId) {
   const url = new URL(relativePath, CHARACTER_RADICALS_ROOT);
   if (buildId) url.searchParams.set("build", buildId);
   return url.href;
}

function validateRadicalsManifest(manifest, dictionaryManifest) {
   if (
      manifest?.format !== "mo-studio-character-radicals" ||
      manifest.schemaVersion !== CHARACTER_RADICALS_SCHEMA_VERSION ||
      typeof manifest.buildId !== "string" || !/^[0-9a-f]{64}$/u.test(manifest.buildId) ||
      manifest.derivedFrom?.dictionaryBuildId !== dictionaryManifest.buildId ||
      !Array.isArray(manifest.radicals)
   ) throw new Error("Manifeste des clés incompatible avec le dictionnaire courant");
   const paths = new Set();
   manifest.radicals.forEach((row) => {
      if (
         !row || typeof row.radical !== "string" || typeof row.path !== "string" ||
         paths.has(row.path) || !Number.isInteger(row.bytes) || row.bytes < 0 ||
         typeof row.sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(row.sha256)
      ) throw new Error("Table d’empreintes des clés invalide");
      paths.add(row.path);
   });
   return manifest;
}

function ensureRadicalsGeneration(dictionaryManifest, manifest) {
   ensureDictionaryGeneration(dictionaryManifest);
   if (radicalsManifest?.buildId !== manifest.buildId)
      throw new StaleDictionaryGenerationError();
}

async function parseRadicalsManifestResponse(response, dictionaryManifest) {
   try {
      return validateRadicalsManifest(await response.json(), dictionaryManifest);
   } catch (error) {
      if (error instanceof StaleDictionaryGenerationError) throw error;
      if (/incompatible|empreintes/u.test(error?.message || "")) throw error;
      throw new Error("Manifeste des clés corrompu");
   }
}

async function fetchCurrentRadicalsManifest(dictionaryManifest, reload) {
   const url = characterRadicalsResourceUrl("manifest.json");
   const cache = await openDictionaryCache();
   let networkError = null;
   let response = null;
   try {
      response = await fetch(url, { cache: reload ? "reload" : "no-cache" });
      if (!response.ok) throw new Error("manifest.json · HTTP " + response.status);
   } catch (error) {
      networkError = error;
   }
   if (response) {
      const manifest = await parseRadicalsManifestResponse(response.clone(), dictionaryManifest);
      if (cache) await cache.put(url, response.clone());
      return manifest;
   }
   if (!reload && cache) {
      const cached = await cache.match(url);
      if (cached) {
         try {
            return await parseRadicalsManifestResponse(cached, dictionaryManifest);
         } catch (error) {
            await cache.delete(url);
            throw error;
         }
      }
   }
   throw networkError || new Error("Données de clés indisponibles");
}

async function loadRadicalsManifest(reload, expectedDictionaryManifest) {
   const dictionaryManifest = expectedDictionaryManifest || await loadDictionaryManifest(reload);
   ensureDictionaryGeneration(dictionaryManifest);
   if (
      radicalsManifest && !reload &&
      radicalsManifest.derivedFrom.dictionaryBuildId === dictionaryManifest.buildId
   ) return radicalsManifest;
   if (
      radicalsManifestPending && !reload &&
      radicalsManifestPendingDictionaryBuildId === dictionaryManifest.buildId
   ) return radicalsManifestPending;

   const epoch = ++radicalsManifestEpoch;
   const request = (async () => {
      const manifest = await fetchCurrentRadicalsManifest(dictionaryManifest, !!reload);
      ensureDictionaryGeneration(dictionaryManifest);
      if (epoch !== radicalsManifestEpoch) throw new StaleDictionaryGenerationError();
      if (radicalsManifest?.buildId !== manifest.buildId) {
         radicalChunkCache.clear();
         radicalChunkPending.clear();
         if (typeof clearRadicalBrowserCache === "function") clearRadicalBrowserCache();
      }
      radicalsManifest = Object.freeze(manifest);
      return radicalsManifest;
   })();
   radicalsManifestPending = request;
   radicalsManifestPendingDictionaryBuildId = dictionaryManifest.buildId;
   try {
      return await request;
   } finally {
      if (radicalsManifestPending === request) {
         radicalsManifestPending = null;
         radicalsManifestPendingDictionaryBuildId = null;
      }
   }
}

async function verifyRadicalChunkResponse(response, descriptor) {
   const bytes = await response.arrayBuffer();
   if (bytes.byteLength !== descriptor.bytes)
      throw new Error(descriptor.path + " · taille différente du manifeste");
   if (await dictionarySha256(bytes) !== descriptor.sha256)
      throw new Error(descriptor.path + " · empreinte SHA-256 différente du manifeste");
   return new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
   });
}

async function fetchRadicalChunkResponse(descriptor, manifest, dictionaryManifest) {
   const url = characterRadicalsResourceUrl(descriptor.path, manifest.buildId);
   const cache = await openDictionaryCache();
   if (cache) {
      const cached = await cache.match(url);
      if (cached) {
         try {
            const response = await verifyRadicalChunkResponse(cached, descriptor);
            ensureRadicalsGeneration(dictionaryManifest, manifest);
            return response;
         } catch (error) {
            await cache.delete(url);
         }
      }
   }
   let response = await fetch(url, { cache: "default" });
   if (!response.ok) throw new Error(descriptor.path + " · HTTP " + response.status);
   try {
      response = await verifyRadicalChunkResponse(response, descriptor);
   } catch (error) {
      response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(descriptor.path + " · HTTP " + response.status);
      response = await verifyRadicalChunkResponse(response, descriptor);
   }
   ensureRadicalsGeneration(dictionaryManifest, manifest);
   if (cache) await cache.put(url, response.clone());
   return response;
}

async function loadRadicalCatalog(options) {
   const reload = !!options?.reload;
   const dictionaryManifest = options?.dictionaryManifest || await loadDictionaryManifest(reload);
   const manifest = await loadRadicalsManifest(reload, dictionaryManifest);
   ensureRadicalsGeneration(dictionaryManifest, manifest);
   return manifest.radicals;
}

async function loadRadicalCharacters(radical, options) {
   const reload = !!options?.reload;
   const dictionaryManifest = options?.dictionaryManifest || await loadDictionaryManifest(reload);
   const manifest = options?.manifest || await loadRadicalsManifest(reload, dictionaryManifest);
   ensureRadicalsGeneration(dictionaryManifest, manifest);
   const cacheKey = manifest.buildId + ":" + radical;
   if (radicalChunkCache.has(cacheKey) && !reload) return radicalChunkCache.get(cacheKey);
   if (radicalChunkPending.has(cacheKey) && !reload) return radicalChunkPending.get(cacheKey);
   const request = (async () => {
      const declared = manifest.radicals.find((row) => row.radical === radical);
      if (!declared) return { radical, characters: [] };
      const response = await fetchRadicalChunkResponse(declared, manifest, dictionaryManifest);
      const chunk = await response.json();
      if (!chunk || chunk.radical !== radical || !Array.isArray(chunk.characters))
         throw new Error("Chunk de clé invalide");
      ensureRadicalsGeneration(dictionaryManifest, manifest);
      const frozen = Object.freeze({ radical, characters: Object.freeze(chunk.characters) });
      radicalChunkCache.set(cacheKey, frozen);
      return frozen;
   })().finally(() => radicalChunkPending.delete(cacheKey));
   radicalChunkPending.set(cacheKey, request);
   return request;
}
