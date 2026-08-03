"use strict";

const STROKE_DATA_VERSION = "2.0.1";
const STROKE_DATA_CACHE_NAME = "mo-studio-strokes-v1";
const STROKE_DATA_ROOT = (() => {
   const portable = /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(
      portable ? "../data/generated/hanzi-writer/2.0.1/" : "data/generated/hanzi-writer/2.0.1/",
      document.baseURI,
   ).href;
})();
const strokeCharacterCache = new Map();
const strokeCharacterPending = new Map();

class StrokeCharacterDataError extends Error {
   constructor(character, message, cause) {
      super(`${character} · ${message}`);
      this.name = "StrokeCharacterDataError";
      this.character = character;
      this.cause = cause;
   }
}

function validateStrokeCharacter(character) {
   const value = String(character || "").normalize("NFC");
   if (Array.from(value).length !== 1 || !/^\p{Script=Han}$/u.test(value)) {
      throw new StrokeCharacterDataError(value || "?", "caractère Han invalide");
   }
   return value;
}

function normalizeStrokeCharacterData(character, raw) {
   if (!raw || !Array.isArray(raw.strokes) || !raw.strokes.length) {
      throw new StrokeCharacterDataError(character, "aucun tracé réel disponible");
   }
   if (raw.strokes.some((path) => typeof path !== "string" || !path.trim())) {
      throw new StrokeCharacterDataError(character, "tracé SVG invalide");
   }
   const medians = Array.isArray(raw.medians) ? raw.medians : [];
   if (medians.length && medians.length !== raw.strokes.length) {
      throw new StrokeCharacterDataError(character, "nombre de médianes incohérent");
   }
   return Object.freeze({
      character,
      strokes: Object.freeze(raw.strokes.slice()),
      medians: Object.freeze(medians.map((median) => Object.freeze(median.slice()))),
      strokeCount: raw.strokes.length,
      radicalStrokeIndexes: Object.freeze(
         Array.isArray(raw.radStrokes) ? raw.radStrokes.slice() : [],
      ),
      sourcePackage: "hanzi-writer-data",
      sourceVersion: STROKE_DATA_VERSION,
   });
}

function strokeCharacterDataUrl(character) {
   return new URL(`${encodeURIComponent(character)}.json`, STROKE_DATA_ROOT).href;
}

async function fetchStrokeCharacterData(character, reload) {
   const url = strokeCharacterDataUrl(character);
   const cache = "caches" in globalThis
      ? await caches.open(STROKE_DATA_CACHE_NAME)
      : null;
   let response = !reload && cache ? await cache.match(url) : null;
   let fromCache = !!response;
   if (!response) {
      response = await fetch(url, { cache: reload ? "reload" : "default" });
      fromCache = false;
   }
   if (!response.ok) {
      throw new StrokeCharacterDataError(
         character,
         response.status === 404 ? "données de traits indisponibles" : `HTTP ${response.status}`,
      );
   }
   let raw;
   try {
      raw = await response.clone().json();
   } catch (error) {
      if (fromCache && cache) {
         await cache.delete(url);
         return fetchStrokeCharacterData(character, true);
      }
      throw new StrokeCharacterDataError(character, "JSON de traits corrompu", error);
   }
   let normalized;
   try {
      normalized = normalizeStrokeCharacterData(character, raw);
   } catch (error) {
      if (fromCache && cache) {
         await cache.delete(url);
         return fetchStrokeCharacterData(character, true);
      }
      throw error;
   }
   if (cache && !fromCache) await cache.put(url, response.clone());
   return normalized;
}

function loadStrokeCharacterData(character, options) {
   const value = validateStrokeCharacter(character);
   const reload = !!(options && options.reload);
   if (!reload && strokeCharacterCache.has(value)) {
      return Promise.resolve(strokeCharacterCache.get(value));
   }
   if (!reload && strokeCharacterPending.has(value)) {
      return strokeCharacterPending.get(value);
   }
   const request = fetchStrokeCharacterData(value, reload)
      .then((data) => {
         strokeCharacterCache.set(value, data);
         return data;
      })
      .catch((error) => {
         if (error instanceof StrokeCharacterDataError) throw error;
         throw new StrokeCharacterDataError(value, "chargement impossible", error);
      })
      .finally(() => strokeCharacterPending.delete(value));
   strokeCharacterPending.set(value, request);
   return request;
}

function preloadStrokeCharacterData(character) {
   return loadStrokeCharacterData(character).catch(() => null);
}

async function invalidateStrokeCharacterData(character) {
   const cache = "caches" in globalThis
      ? await caches.open(STROKE_DATA_CACHE_NAME)
      : null;
   if (character) {
      const value = validateStrokeCharacter(character);
      strokeCharacterCache.delete(value);
      strokeCharacterPending.delete(value);
      if (cache) await cache.delete(strokeCharacterDataUrl(value));
      return;
   }
   strokeCharacterCache.clear();
   strokeCharacterPending.clear();
   if ("caches" in globalThis) await caches.delete(STROKE_DATA_CACHE_NAME);
}
