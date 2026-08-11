"use strict";

const SEARCH_RESULT_LIMIT = 96;
const SEARCH_PREFIX_KEY_LIMIT = 160;
let dictionarySearchEpoch = 0;
let dictionaryPersonalRevision = 0;
const dictionarySearchCache = new Map();
const dictionaryFrenchSiblingCache = new Map();
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
   dictionaryFrenchSiblingCache.clear();
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
      dictionaryEntryId: card.dictionaryEntryId || "",
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

function dictionaryEntryPronunciationKeys(entry) {
   if (entry.__displayReadingNumbered)
      return new Set([normalizePinyinNumbered(entry.__displayReadingNumbered)].filter(Boolean));
   return new Set(
      entryPinyinVariants(entry)
         .map((variant) => normalizePinyinNumbered(variant.numbered || variant.marked || ""))
         .filter(Boolean),
   );
}

function dictionaryReadingMatchesPinyin(reading, query) {
   const variant = reading.pinyin || {};
   const marked = normalizePinyinMarked(variant.marked || variant.numbered || "");
   const numbered = normalizePinyinNumbered(variant.numbered || variant.marked || "");
   const plain = normalizePinyinPlain(variant.plain || variant.numbered || variant.marked || "");
   if (query.type === "pinyin-marked") return marked === query.marked;
   if (query.type === "pinyin-numbered") return numbered === query.numbered;
   return plain === query.plain || plain.startsWith(query.plain);
}

function dictionaryReadingMatchesTranslation(reading, query, englishFallback) {
   const field = englishFallback ? "definitionsEn" : "definitionsFr";
   const words = (reading[field] || [])
      .flatMap((definition) => normalizeTranslation(definition).split(" "))
      .filter(Boolean);
   return (query.tokens || []).every((token) =>
      words.some((word) => word === token || word.startsWith(token)),
   );
}

function dictionaryEntryForReading(entry, numbered) {
   if (!entry || !Array.isArray(entry.readings) || !entry.readings.length) return entry;
   const reading = entry.readings.find((candidate) =>
      normalizePinyinNumbered(candidate.pinyin?.numbered || candidate.pinyin?.marked || "") === numbered,
   ) || entry.readings[0];
   return {
      ...entry,
      pinyin: reading.pinyin ? [reading.pinyin] : [],
      definitionsFr: (reading.definitionsFr || []).slice(),
      definitionsEn: (reading.definitionsEn || []).slice(),
      frenchStatus: reading.frenchStatus || ((reading.definitionsFr || []).length ? "source" : "unavailable"),
      __displayReadingNumbered: reading.pinyin?.numbered || "",
   };
}

function dictionaryEntryForQuery(entry, query, englishFallback) {
   if (!entry || !Array.isArray(entry.readings) || !entry.readings.length) return entry;
   let reading = null;
   if (query.type.startsWith("pinyin"))
      reading = entry.readings.find((candidate) => dictionaryReadingMatchesPinyin(candidate, query));
   else if (query.type === "translation")
      reading = entry.readings.find((candidate) =>
         dictionaryReadingMatchesTranslation(candidate, query, englishFallback),
      );
   return dictionaryEntryForReading(
      entry,
      (reading || entry.readings[0]).pinyin?.numbered || "",
   );
}

async function dictionaryEntryWithFrenchSibling(entry) {
   if (!entry || (entry.definitionsFr || []).length || !entry.simplified) return entry;
   const pronunciation = Array.from(dictionaryEntryPronunciationKeys(entry)).sort().join("/");
   const cacheKey = entry.simplified + "§" + pronunciation;
   if (!dictionaryFrenchSiblingCache.has(cacheKey)) {
      dictionaryFrenchSiblingCache.set(cacheKey, (async () => {
         const index = await loadDictionaryIndex("exactHanzi", false);
         const references = index[entry.simplified] || [];
         if (!references.length) return null;
         const exactEntries = (await loadDictionaryEntriesByReferences(references)).filter(
            (candidate) =>
               candidate.simplified === entry.simplified &&
               candidate.id !== entry.id &&
               (candidate.definitionsFr || []).length,
         );
         if (!exactEntries.length) return null;
         const samePronunciation = pronunciation
            ? exactEntries.filter((candidate) => dictionaryEntriesSharePronunciation(entry, candidate))
            : [];
         const sibling = samePronunciation[0] || (!pronunciation ? exactEntries[0] : null);
         if (!sibling) return null;
         return {
            entryId: sibling.id,
            definitionsFr: sibling.definitionsFr.slice(),
         };
      })().catch((error) => {
         dictionaryFrenchSiblingCache.delete(cacheKey);
         throw error;
      }));
   }
   const french = await dictionaryFrenchSiblingCache.get(cacheKey);
   return french
      ? {
           ...entry,
           definitionsFr: french.definitionsFr.slice(),
           __frenchSiblingEntryId: french.entryId,
        }
      : entry;
}

function annotateDictionaryScriptVariants(entries, query) {
   const modern = new Set();
   entries.forEach((entry) => {
      if (entry.entryType !== "word" || entry.simplified !== entry.traditional) return;
      dictionaryEntryPronunciationKeys(entry).forEach((pinyin) => modern.add(entry.simplified + "§" + pinyin));
   });
   entries.forEach((entry) => {
      entry.__scriptVariant = false;
      if (entry.entryType !== "word" || entry.simplified === entry.traditional) return;
      entry.__scriptVariant = Array.from(dictionaryEntryPronunciationKeys(entry)).some((pinyin) =>
         modern.has(entry.simplified + "§" + pinyin),
      );
   });
}

function dictionaryEntriesSharePronunciation(left, right) {
   const leftPinyin = dictionaryEntryPronunciationKeys(left);
   return Array.from(dictionaryEntryPronunciationKeys(right)).some((pinyin) => leftPinyin.has(pinyin));
}

function dictionaryExplicitVariantTargets(entry) {
   if (dictionaryVariantStatus(entry) === "modern") return new Set();
   const definitions = [...(entry.definitionsFr || []), ...(entry.definitionsEn || [])].join(" ");
   if (!/variante?|variant|ancienne?|archaic|old form/iu.test(definitions)) return new Set();
   return new Set((definitions.match(/\p{Script=Han}+/gu) || []).flatMap((value) => Array.from(value)));
}

function isVisualScriptVariantOf(candidate, primary) {
   if (!candidate || !primary || candidate.id === primary.id) return false;
   if (primary.traditional !== primary.simplified) return false;
   const traditionalWord =
      candidate.entryType === "word" && candidate.simplified === primary.simplified &&
      candidate.traditional && candidate.traditional !== candidate.simplified;
   const explicitVariant = dictionaryExplicitVariantTargets(candidate).has(primary.simplified);
   if (!traditionalWord && !explicitVariant) return false;
   return dictionaryEntriesSharePronunciation(candidate, primary);
}

function querySelectsTraditionalEntry(query, entry) {
   return !!(
      query && query.type && query.type.startsWith("hanzi") &&
      query.hanzi === entry.traditional && entry.traditional !== entry.simplified
   );
}

function groupDictionaryScriptVariants(response) {
   if (!response || !Array.isArray(response.results)) return response;
   const hidden = new Set();
   response.results.forEach((result) => {
      const candidate = result.entry;
      if (querySelectsTraditionalEntry(response.query, candidate)) return;
      const primary = response.results.find((item) =>
         !hidden.has(item.entry.id) && isVisualScriptVariantOf(candidate, item.entry),
      );
      if (!primary) return;
      mergeDictionaryResultBadgeMetadata(primary, result);
      primary.entry.visualVariants = [...(primary.entry.visualVariants || []), candidate];
      hidden.add(candidate.id);
   });
   response.results = response.results.filter((result) => !hidden.has(result.entry.id));
   response.results.forEach((result) => {
      if (!result.entry.visualVariants) return;
      result.entry.visualVariants.sort((left, right) =>
         (left.traditional || left.simplified).localeCompare(right.traditional || right.simplified, "zh"),
      );
   });
   response.visualVariantsGrouped = hidden.size;
   return response;
}

function mergeDictionaryResultBadgeMetadata(primary, duplicate) {
   const entry = primary.entry;
   const other = duplicate.entry;
   entry.hskLegacy = Array.from(new Set([...(entry.hskLegacy || []), ...(other.hskLegacy || [])]));
   entry.hsk30 = Array.from(new Set([...(entry.hsk30 || []), ...(other.hsk30 || [])]));
   entry.hskVerified = [...(entry.hskVerified || []), ...(other.hskVerified || [])].filter(
      (item, index, values) => values.findIndex((candidate) => candidate.hskEntryId === item.hskEntryId) === index,
   );
   if (other.personalCard && !entry.personalCard) entry.personalCard = other.personalCard;
}

function dictionaryDefinitionKeys(entry) {
   return new Set(
      [...entryDefinitions(entry, "fr"), ...entryDefinitions(entry, "en")]
         .map(normalizeTranslation)
         .filter(Boolean),
   );
}

function visuallyEquivalentDictionaryEntries(left, right) {
   if (left.entryType === right.entryType) return false;
   const word = left.entryType === "word" ? left : right.entryType === "word" ? right : null;
   const character = left.entryType === "character" ? left : right.entryType === "character" ? right : null;
   if (!word || !character) return false;
   const sameModernForm = word.simplified === character.simplified && word.traditional === word.simplified;
   const sameTraditionalForm = word.traditional !== word.simplified && word.traditional === character.simplified;
   if (!sameModernForm && !sameTraditionalForm) return false;
   const leftPinyin = dictionaryEntryPronunciationKeys(left);
   if (!Array.from(dictionaryEntryPronunciationKeys(right)).some((pinyin) => leftPinyin.has(pinyin))) return false;
   const leftDefinitions = dictionaryDefinitionKeys(left);
   return Array.from(dictionaryDefinitionKeys(right)).some((definition) => leftDefinitions.has(definition));
}

function mergeDictionaryResultMetadata(primary, duplicate) {
   const entry = primary.entry;
   const other = duplicate.entry;
   entry.visualGroup = Array.from(new Set([
      ...(entry.visualGroup || [entry.id]),
      ...(other.visualGroup || [other.id]),
   ]));
   entry.visualEntryTypes = Array.from(new Set([
      ...(entry.visualEntryTypes || [entry.entryType]),
      ...(other.visualEntryTypes || [other.entryType]),
   ]));
   entry.sources = Array.from(new Set([...(entry.sources || []), ...(other.sources || [])]));
   mergeDictionaryResultBadgeMetadata(primary, duplicate);
   if (!entry.definitionsFr?.length && other.definitionsFr?.length) {
      const primaryMeanings = dictionaryDefinitionKeys(entry);
      entry.definitionsFr = other.definitionsFr.filter((definition) =>
         primaryMeanings.has(normalizeTranslation(definition)),
      );
   }
   primary.rank.score = Math.max(primary.rank.score, duplicate.rank.score);
   return primary;
}

function mergeDictionaryVisualResults(response) {
   if (!response || !Array.isArray(response.results)) return response;
   if (response.visualPresentationReady) return response;
   const output = [];
   let merged = 0;
   response.results.forEach((result) => {
      const match = output.find((candidate) =>
         visuallyEquivalentDictionaryEntries(candidate.entry, result.entry),
      );
      if (!match) output.push(result);
      else {
         mergeDictionaryResultMetadata(match, result);
         merged++;
      }
   });
   response.results = output.sort(compareRankedDictionaryEntries);
   response.visualDuplicatesMerged = merged;
   groupDictionaryScriptVariants(response);
   response.visualPresentationReady = true;
   return response;
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
   const dictionaryEntries = (await loadDictionaryPreviewsByReferences(references)).map((entry) =>
      dictionaryEntryForQuery(entry, query, indexed.englishFallback),
   );
   ensureCurrentSearch(epoch);

   const personalEntries = db.cards
      .map(personalCardAsDictionaryEntry)
      .filter((entry) => personalEntryMatches(entry, query));
   const personalBySourceId = new Map(
      personalEntries.filter((entry) => entry.dictionaryEntryId).map((entry) => [entry.dictionaryEntryId, entry.personalCard]),
   );
   const legacyPersonalByIdentity = new Map(
      personalEntries.filter((entry) => !entry.dictionaryEntryId).map((entry) => [dictionaryEntryIdentity(entry), entry.personalCard]),
   );
   dictionaryEntries.forEach((entry) => {
      const card = personalBySourceId.get(entry.id) || legacyPersonalByIdentity.get(dictionaryEntryIdentity(entry));
      if (card) entry.personalCard = card;
   });

   const dictionaryIdentities = new Set(dictionaryEntries.map(dictionaryEntryIdentity));
   const dictionaryIds = new Set(dictionaryEntries.map((entry) => entry.id));
   const merged = [
      ...dictionaryEntries,
      ...personalEntries.filter((entry) =>
         entry.dictionaryEntryId
            ? !dictionaryIds.has(entry.dictionaryEntryId)
            : !dictionaryIdentities.has(dictionaryEntryIdentity(entry)),
      ),
   ];
   annotateDictionaryScriptVariants(merged, query);
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
