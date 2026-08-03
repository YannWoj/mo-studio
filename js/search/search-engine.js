"use strict";

const SEARCH_RESULT_LIMIT = 96;
const SEARCH_PREFIX_KEY_LIMIT = 160;
let dictionarySearchEpoch = 0;
let dictionaryPersonalRevision = 0;
const dictionarySearchCache = new Map();
const dictionaryPrefixCache = new WeakMap();
const DICTIONARY_SEARCH_CACHE_LIMIT = 24;

class StaleDictionarySearchError extends Error {
   constructor() {
      super("Recherche remplacée par une requête plus récente.");
      this.name = "StaleDictionarySearchError";
   }
}

function invalidateDictIndex() {
   dictionaryPersonalRevision++;
   dictionarySearchCache.clear();
}

function clearDictionarySearchCache() {
   dictionarySearchCache.clear();
}

function cancelDictionarySearches() {
   dictionarySearchEpoch++;
   if (typeof rejectPendingDictionaryWorkerSearches === "function")
      rejectPendingDictionaryWorkerSearches();
}

function ensureCurrentSearch(epoch) {
   if (epoch !== dictionarySearchEpoch) throw new StaleDictionarySearchError();
}

function postingIntersection(postings) {
   if (!postings.length) return [];
   if (postings.length === 1) return postings[0].slice();
   const remaining = postings.slice(1).map((values) => new Set(values));
   return postings[0].filter((reference) =>
      remaining.every((values) => values.has(reference)),
   );
}

function prefixPostings(index, prefix, maximumKeys) {
   let cachedByPrefix = dictionaryPrefixCache.get(index);
   if (!cachedByPrefix) {
      cachedByPrefix = new Map();
      dictionaryPrefixCache.set(index, cachedByPrefix);
   }
   const cacheKey = prefix + "§" + (maximumKeys || SEARCH_PREFIX_KEY_LIMIT);
   if (cachedByPrefix.has(cacheKey)) return cachedByPrefix.get(cacheKey);
   const output = [];
   let matchedKeys = 0;
   for (const key of Object.keys(index)) {
      if (!key.startsWith(prefix) || key === prefix) continue;
      output.push(index[key]);
      matchedKeys++;
      if (matchedKeys >= (maximumKeys || SEARCH_PREFIX_KEY_LIMIT)) break;
   }
   cachedByPrefix.set(cacheKey, output);
   return output;
}

function dictionarySearchCacheKey(query, settings) {
   return JSON.stringify([
      dictionaryPersonalRevision,
      query.type,
      query.hanzi || "",
      query.marked || "",
      query.numbered || "",
      query.plain || "",
      query.translation || "",
      settings.candidateLimit || SEARCH_RESULT_LIMIT,
      settings.limit || SEARCH_RESULT_LIMIT,
   ]);
}

function rememberDictionarySearch(key, response) {
   dictionarySearchCache.delete(key);
   dictionarySearchCache.set(key, response);
   while (dictionarySearchCache.size > DICTIONARY_SEARCH_CACHE_LIMIT) {
      const oldest = dictionarySearchCache.keys().next().value;
      dictionarySearchCache.delete(oldest);
   }
}

function addCandidateReferences(target, references, matchKind, maximum) {
   for (const reference of references || []) {
      if (!target.has(reference)) target.set(reference, matchKind);
      if (target.size >= maximum) return;
   }
}

function personalCardAsDictionaryEntry(card) {
   const marked = normalizePinyinMarked(card.py || "");
   return {
      id: "personal-" + card.id,
      simplified: card.hz,
      traditional: card.hz,
      entryType: Array.from(card.hz).length === 1 ? "character" : "word",
      pinyin: marked
         ? [
              {
                 marked,
                 numbered: normalizePinyinNumbered(marked),
                 plain: normalizePinyinPlain(marked),
              },
           ]
         : [],
      definitionsFr: card.fr ? [card.fr] : [],
      definitionsEn: [],
      sources: [],
      sourceRefs: [],
      hskLegacy: [],
      hsk30: [],
      frequencyRank: null,
      characters: Array.from(card.hz).filter((character) => HAN_PATTERN.test(character)),
      searchAliases: [],
      personalCard: card,
      cardId: card.id,
      src: "card",
   };
}

function personalEntryMatches(entry, query) {
   if (query.type.startsWith("hanzi"))
      return entry.simplified.includes(query.hanzi);
   if (query.type.startsWith("pinyin")) {
      return entry.pinyin.some((variant) => {
         if (query.type === "pinyin-marked") return variant.marked === query.marked;
         if (query.type === "pinyin-numbered") return variant.numbered === query.numbered;
         return variant.plain === query.plain || variant.plain.startsWith(query.plain);
      });
   }
   if (query.type === "translation") {
      const words = normalizeTranslation(entry.definitionsFr.join(" ")).split(" ");
      return query.tokens.every((token) =>
         words.some((word) => word === token || word.startsWith(token)),
      );
   }
   return false;
}

function dictionaryEntryIdentity(entry) {
   const pronunciation = entry.pinyin[0]
      ? normalizePinyinNumbered(entry.pinyin[0].numbered || entry.pinyin[0].marked)
      : "";
   return entry.simplified + "§" + pronunciation;
}

async function collectIndexedCandidates(query, epoch, onStatus, maximumCandidates) {
   const candidates = new Map();
   const maximum = maximumCandidates || SEARCH_RESULT_LIMIT;
   let englishFallback = false;
   let sequence = false;
   const status = (message) => onStatus && onStatus(message);

   if (query.type.startsWith("hanzi")) {
      status("Chargement de l’index des caractères…");
      const index = await loadDictionaryIndex("exactHanzi", false);
      ensureCurrentSearch(epoch);
      const exact = index[query.hanzi] || [];
      addCandidateReferences(candidates, exact, "exact-hanzi", maximum);

      if (query.characters.length > 1 && exact.length === 0) {
         sequence = true;
         query.characters.forEach((character) =>
            addCandidateReferences(candidates, index[character], "sequence-character", maximum),
         );
      } else {
         const prefixGroups = prefixPostings(index, query.hanzi, SEARCH_PREFIX_KEY_LIMIT);
         prefixGroups.forEach((references) =>
            addCandidateReferences(candidates, references, "hanzi-prefix", maximum),
         );
         if (candidates.size < maximum && query.hanzi.length <= 3) {
            for (const key of Object.keys(index)) {
               if (key === query.hanzi || key.startsWith(query.hanzi) || !key.includes(query.hanzi)) continue;
               addCandidateReferences(candidates, index[key], "hanzi-contains", maximum);
               if (candidates.size >= maximum) break;
            }
         }
      }
   } else if (query.type.startsWith("pinyin")) {
      status("Chargement de l’index pinyin…");
      const index = await loadDictionaryIndex("pinyin", false);
      ensureCurrentSearch(epoch);
      const strictKey =
         query.type === "pinyin-marked"
            ? query.marked
            : query.type === "pinyin-numbered"
              ? query.numbered
              : query.plain;
      addCandidateReferences(candidates, index[strictKey], "exact-pinyin", maximum);
      prefixPostings(index, strictKey, SEARCH_PREFIX_KEY_LIMIT).forEach((references) =>
         addCandidateReferences(candidates, references, "pinyin-prefix", maximum),
      );
      if (query.type !== "pinyin-plain" && candidates.size < maximum) {
         addCandidateReferences(candidates, index[query.plain], "toneless-fallback", maximum);
      }
   } else if (query.type === "translation") {
      status("Chargement de l’index français…");
      const french = await loadDictionaryIndex("french", false);
      ensureCurrentSearch(epoch);
      const exactGroups = query.tokens.map((token) => french[token] || []);
      const exact = postingIntersection(exactGroups);
      addCandidateReferences(candidates, exact, "exact-french", maximum);
      if (candidates.size < maximum) {
         const perToken = query.tokens.map((token) => {
            const references = new Set(french[token] || []);
            prefixPostings(french, token, 80).forEach((posting) =>
               posting.forEach((reference) => references.add(reference)),
            );
            return Array.from(references);
         });
         addCandidateReferences(
            candidates,
            postingIntersection(perToken),
            "french-prefix",
            maximum,
         );
      }
      if (candidates.size === 0) {
         status("Aucun résultat français · essai du repli anglais…");
         const english = await loadDictionaryIndex("english", false);
         ensureCurrentSearch(epoch);
         const groups = query.tokens.map((token) => english[token] || []);
         addCandidateReferences(
            candidates,
            postingIntersection(groups),
            "english-fallback",
            maximum,
         );
         englishFallback = candidates.size > 0;
      }
   }

   return { candidates, englishFallback, sequence };
}

async function searchDictionaryLocally(rawQuery, options) {
   const settings = options || {};
   const started = performance.now();
   const epoch = ++dictionarySearchEpoch;
   const query = classifySearchQuery(rawQuery);
   if (!query.valid) {
      return {
         query,
         results: [],
         totalCandidates: 0,
         limited: false,
         englishFallback: false,
         sequence: false,
         durationMs: performance.now() - started,
      };
   }

   const cacheKey = dictionarySearchCacheKey(query, settings);
   if (dictionarySearchCache.has(cacheKey)) {
      const cached = dictionarySearchCache.get(cacheKey);
      dictionarySearchCache.delete(cacheKey);
      dictionarySearchCache.set(cacheKey, cached);
      return {
         ...cached,
         cached: true,
         durationMs: performance.now() - started,
      };
   }

   const revision = dictionaryPersonalRevision;
   const candidateLimit = Math.max(1, Math.min(settings.candidateLimit || SEARCH_RESULT_LIMIT, SEARCH_RESULT_LIMIT));
   const indexed = await collectIndexedCandidates(query, epoch, settings.onStatus, candidateLimit);
   ensureCurrentSearch(epoch);
   const references = Array.from(indexed.candidates.keys()).slice(0, candidateLimit);
   if (settings.onStatus) settings.onStatus("Chargement des meilleures fiches…");
   const dictionaryEntries = await loadDictionaryPreviewsByReferences(references);
   ensureCurrentSearch(epoch);

   const personalEntries = db.cards
      .map(personalCardAsDictionaryEntry)
      .filter((entry) => personalEntryMatches(entry, query));
   const personalByIdentity = new Map(
      personalEntries.map((entry) => [dictionaryEntryIdentity(entry), entry.personalCard]),
   );
   dictionaryEntries.forEach((entry) => {
      const card = personalByIdentity.get(dictionaryEntryIdentity(entry));
      if (card) entry.personalCard = card;
   });

   const dictionaryIdentities = new Set(dictionaryEntries.map(dictionaryEntryIdentity));
   const merged = [
      ...dictionaryEntries,
      ...personalEntries.filter((entry) => !dictionaryIdentities.has(dictionaryEntryIdentity(entry))),
   ];
   const ranked = merged
      .map((entry) => ({
         entry,
         rank: rankDictionaryEntry(entry, query, {
            englishFallback: indexed.englishFallback,
            indexedMatch: indexed.candidates.get(entry.__reference),
         }),
      }))
      .sort(compareRankedDictionaryEntries);

   ensureCurrentSearch(epoch);
   const response = {
      query: indexed.sequence ? { ...query, type: "hanzi-sequence" } : query,
      results: ranked.slice(0, settings.limit || SEARCH_RESULT_LIMIT),
      totalCandidates: indexed.candidates.size + personalEntries.length,
      limited: indexed.candidates.size >= candidateLimit,
      englishFallback: indexed.englishFallback,
      sequence: indexed.sequence,
      personalRevision: revision,
      durationMs: performance.now() - started,
   };
   rememberDictionarySearch(cacheKey, response);
   return response;
}

let dictionarySearchWorker = null;
let dictionarySearchWorkerSequence = 0;
const dictionarySearchWorkerRequests = new Map();

function canUseDictionarySearchWorker() {
   if (typeof window === "undefined" || typeof Worker === "undefined") return false;
   const path = new URL(document.baseURI).pathname;
   return !/\/dist\/[^/]+\.html$/u.test(path) && location.protocol !== "file:";
}

function rejectPendingDictionaryWorkerSearches() {
   dictionarySearchWorkerRequests.forEach(({ reject }) =>
      reject(new StaleDictionarySearchError()),
   );
   dictionarySearchWorkerRequests.clear();
}

function getDictionarySearchWorker() {
   if (dictionarySearchWorker) return dictionarySearchWorker;
   const url = new URL("js/search/dictionary-search-worker.js", document.baseURI);
   dictionarySearchWorker = new Worker(url.href);
   dictionarySearchWorker.addEventListener("message", (event) => {
      const message = event.data || {};
      const request = dictionarySearchWorkerRequests.get(message.id);
      if (!request) return;
      if (message.type === "status") {
         if (request.onStatus) request.onStatus(message.message);
         return;
      }
      dictionarySearchWorkerRequests.delete(message.id);
      if (message.type === "result") request.resolve(message.response);
      else if (message.stale) request.reject(new StaleDictionarySearchError());
      else request.reject(new Error(message.error || "Recherche dictionnaire impossible."));
   });
   dictionarySearchWorker.addEventListener("error", (event) => {
      const error = new Error(event.message || "Le moteur de recherche isolé a échoué.");
      dictionarySearchWorkerRequests.forEach(({ reject }) => reject(error));
      dictionarySearchWorkerRequests.clear();
      dictionarySearchWorker.terminate();
      dictionarySearchWorker = null;
   });
   return dictionarySearchWorker;
}

function resetDictionarySearchWorker() {
   rejectPendingDictionaryWorkerSearches();
   if (!dictionarySearchWorker) return;
   dictionarySearchWorker.postMessage({ type: "reset" });
}

function searchDictionary(rawQuery, options) {
   if (!canUseDictionarySearchWorker()) return searchDictionaryLocally(rawQuery, options);
   rejectPendingDictionaryWorkerSearches();
   const settings = options || {};
   const id = ++dictionarySearchWorkerSequence;
   const worker = getDictionarySearchWorker();
   return new Promise((resolve, reject) => {
      dictionarySearchWorkerRequests.set(id, {
         resolve,
         reject,
         onStatus: settings.onStatus,
      });
      worker.postMessage({
         type: "search",
         id,
         rawQuery,
         settings: {
            candidateLimit: settings.candidateLimit,
            limit: settings.limit,
         },
         personalCards: Array.isArray(db.cards) ? db.cards : [],
         personalRevision: dictionaryPersonalRevision,
      });
   });
}

async function findDictionaryEntryByHanzi(hanzi) {
   const response = await searchDictionary(hanzi, { candidateLimit: 12, limit: 12 });
   return response.results[0] ? response.results[0].entry : null;
}
