"use strict";

const HSK_RUNTIME_SCHEMA_VERSION = 1;
const HSK_RESULT_LIMIT = 48;
const HSK_RUNTIME_ROOT = (() => {
   const portable =
      typeof document !== "undefined" &&
      /\/dist\/[^/]+\.html$/u.test(new URL(document.baseURI).pathname);
   return new URL(
      portable ? "../data/generated/hsk/runtime/" : "data/generated/hsk/runtime/",
      typeof document === "undefined" ? "http://localhost/" : document.baseURI,
   ).href;
})();

const hskDataState = {
   manifest: null,
   searchEntries: null,
   entriesById: new Map(),
   entriesByDictionaryId: new Map(),
   levels: new Map(),
   error: null,
};

function hskRuntimeUrl(relativePath) {
   return new URL(relativePath, HSK_RUNTIME_ROOT).href;
}

async function fetchHskJson(relativePath) {
   const response = await fetch(hskRuntimeUrl(relativePath), { cache: "default" });
   if (!response.ok) throw new Error(relativePath + " · HTTP " + response.status);
   try {
      return await response.json();
   } catch (error) {
      throw new Error(relativePath + " · JSON HSK invalide");
   }
}

function validateHskPayload(payload, label) {
   if (
      !payload ||
      payload.schemaVersion !== HSK_RUNTIME_SCHEMA_VERSION ||
      !Array.isArray(payload.fields) ||
      !Array.isArray(payload.entries)
   ) {
      throw new Error(label + " · données HSK incompatibles");
   }
   return payload;
}

function decodeHskPayload(payload) {
   const indexes = Object.fromEntries(payload.fields.map((field, index) => [field, index]));
   const required = [
      "hskEntryId",
      "chinese",
      "pinyin",
      "hskLevel",
      "firstHskLevel",
      "sourceLevels",
      "sourceTranslation",
      "dictionaryEntryId",
      "dictionaryLinkStatus",
   ];
   if (required.some((field) => indexes[field] == null)) {
      throw new Error("Champs HSK requis absents.");
   }
   return payload.entries.map((row) => ({
      hskEntryId: row[indexes.hskEntryId],
      chinese: row[indexes.chinese],
      pinyin: row[indexes.pinyin],
      hskLevel: Number(row[indexes.hskLevel]),
      firstHskLevel: Number(row[indexes.firstHskLevel]),
      sourceLevels: row[indexes.sourceLevels] || [],
      partOfSpeech: row[indexes.partOfSpeech] ?? null,
      sourceTranslation: row[indexes.sourceTranslation] || "",
      dictionaryEntryId: row[indexes.dictionaryEntryId] || null,
      dictionaryLinkStatus: row[indexes.dictionaryLinkStatus],
      senseId: row[indexes.senseId] || null,
      baseDictionaryLinkStatus:
         row[indexes.baseDictionaryLinkStatus] || row[indexes.dictionaryLinkStatus],
      selectedDictionaryPronunciation:
         row[indexes.selectedPronunciationMarked] ||
         row[indexes.selectedPronunciationNumbered] ||
         row[indexes.selectedPronunciationPlain]
            ? {
                 marked: row[indexes.selectedPronunciationMarked] || "",
                 numbered: row[indexes.selectedPronunciationNumbered] || "",
                 plain: row[indexes.selectedPronunciationPlain] || "",
              }
            : null,
   }));
}

async function loadHskManifest() {
   if (hskDataState.manifest) return hskDataState.manifest;
   try {
      const manifest = await fetchHskJson("manifest.json");
      if (
         !manifest ||
         manifest.format !== "mo-studio-hsk-runtime" ||
         manifest.schemaVersion !== HSK_RUNTIME_SCHEMA_VERSION ||
         manifest.totalEntries !== 5399 ||
         !manifest.countsByFirstHskLevel ||
         !manifest.searchIndex ||
         !manifest.levelPathTemplate
      ) {
         throw new Error("Manifeste HSK absent, corrompu ou incompatible.");
      }
      hskDataState.manifest = manifest;
      return manifest;
   } catch (error) {
      hskDataState.error = error;
      throw error;
   }
}

function indexHskEntries(entries) {
   for (const entry of entries) {
      hskDataState.entriesById.set(entry.hskEntryId, entry);
      if (!entry.dictionaryEntryId) continue;
      if (!hskDataState.entriesByDictionaryId.has(entry.dictionaryEntryId))
         hskDataState.entriesByDictionaryId.set(entry.dictionaryEntryId, []);
      const linked = hskDataState.entriesByDictionaryId.get(entry.dictionaryEntryId);
      if (!linked.some((item) => item.hskEntryId === entry.hskEntryId)) linked.push(entry);
   }
}

async function loadHskSearchIndex() {
   if (hskDataState.searchEntries) return hskDataState.searchEntries;
   const manifest = await loadHskManifest();
   const payload = validateHskPayload(
      await fetchHskJson(manifest.searchIndex),
      manifest.searchIndex,
   );
   const entries = decodeHskPayload(payload);
   if (entries.length !== manifest.totalEntries)
      throw new Error("Index HSK incomplet.");
   hskDataState.searchEntries = entries;
   indexHskEntries(entries);
   return entries;
}

async function loadHskLevel(level) {
   const numericLevel = Number(level);
   if (!Number.isInteger(numericLevel) || numericLevel < 1 || numericLevel > 6)
      throw new Error("Niveau HSK invalide.");
   if (hskDataState.levels.has(numericLevel)) return hskDataState.levels.get(numericLevel);
   const manifest = await loadHskManifest();
   const relativePath = manifest.levelPathTemplate.replace("{level}", numericLevel);
   const payload = validateHskPayload(await fetchHskJson(relativePath), relativePath);
   const entries = decodeHskPayload(payload);
   const expected = Number(manifest.countsByFirstHskLevel[numericLevel]);
   if (
      payload.level !== numericLevel ||
      entries.length !== expected ||
      entries.some((entry) => entry.firstHskLevel !== numericLevel)
   ) {
      throw new Error(`Fragment HSK ${numericLevel} incohérent.`);
   }
   hskDataState.levels.set(numericLevel, entries);
   indexHskEntries(entries);
   return entries;
}

function hskMetadata(entry) {
   return {
      hskEntryId: entry.hskEntryId,
      level: entry.firstHskLevel,
      firstHskLevel: entry.firstHskLevel,
      sourceLevels: entry.sourceLevels,
      sourcePinyin: entry.pinyin,
      sourceTranslation: entry.sourceTranslation,
      partOfSpeech: entry.partOfSpeech,
      dictionaryLinkStatus: entry.dictionaryLinkStatus,
      baseDictionaryLinkStatus: entry.baseDictionaryLinkStatus,
      senseId: entry.senseId,
   };
}

function verifiedHskLevels(entry) {
   return Array.from(
      new Set(
         (Array.isArray(entry && entry.hskVerified) ? entry.hskVerified : [])
            .map((item) => Number(item.firstHskLevel ?? item.level))
            .filter((level) => Number.isInteger(level) && level >= 1 && level <= 6),
      ),
   ).sort((left, right) => left - right);
}

function hskLinkStatusLabel(status) {
   if (status === "source-only") return "Données HSK source";
   if (status === "ambiguous") return "Liaison dictionnaire ambiguë";
   if (status === "normalized-pinyin") return "Pinyin normalisé";
   if (status === "duplicate-sense") return "Sens HSK distinct";
   return "Liaison exacte";
}

function attachHskMetadata(dictionaryEntry, explicitEntries) {
   if (!dictionaryEntry) return dictionaryEntry;
   const linked = explicitEntries || hskDataState.entriesByDictionaryId.get(dictionaryEntry.id) || [];
   if (linked.length) dictionaryEntry.hskVerified = linked.map(hskMetadata);
   return dictionaryEntry;
}

function hskSourceAsDictionaryEntry(entry) {
   const marked = normalizeVisibleWhitespace(entry.pinyin);
   const isFrenchSource = entry.firstHskLevel === 1;
   return {
      id: entry.hskEntryId,
      simplified: entry.chinese,
      traditional: entry.chinese,
      entryType: Array.from(entry.chinese).length === 1 ? "character" : "word",
      pinyin: marked
         ? [
              {
                 marked,
                 numbered: entry.selectedDictionaryPronunciation?.numbered || "",
                 plain: normalizePinyinPlain(entry.pinyin),
              },
           ]
         : [],
      definitionsFr: isFrenchSource && entry.sourceTranslation ? [entry.sourceTranslation] : [],
      definitionsEn: !isFrenchSource && entry.sourceTranslation ? [entry.sourceTranslation] : [],
      sources: ["Liste HSK source"],
      sourceRefs: [],
      hskLegacy: [],
      hsk30: [],
      hskVerified: [hskMetadata(entry)],
      frequencyRank: null,
      characters: Array.from(entry.chinese).filter((character) => HAN_PATTERN.test(character)),
      dictionaryEntryId: entry.dictionaryEntryId,
      dictionaryLinkStatus: entry.dictionaryLinkStatus,
      hskSourceEntry: entry,
      __hskSource: true,
   };
}

function hskEntryMatchesQuery(entry, query) {
   if (!query || !query.valid) return false;
   if (query.type.startsWith("hanzi"))
      return entry.chinese.includes(query.hanzi);
   if (query.type.startsWith("pinyin")) {
      const plain = normalizePinyinPlain(entry.pinyin);
      return plain === query.plain || plain.startsWith(query.plain);
   }
   if (query.type === "translation") {
      const translation = normalizeTranslation(entry.sourceTranslation);
      return query.tokens.every((token) =>
         translation.split(" ").some((word) => word === token || word.startsWith(token)),
      );
   }
   return false;
}

function compareHskSourceMatches(left, right, query) {
   const leftExact = query.type.startsWith("hanzi") && left.chinese === query.hanzi;
   const rightExact = query.type.startsWith("hanzi") && right.chinese === query.hanzi;
   return (
      Number(rightExact) - Number(leftExact) ||
      left.firstHskLevel - right.firstHskLevel ||
      left.chinese.localeCompare(right.chinese, "zh") ||
      left.hskEntryId.localeCompare(right.hskEntryId)
   );
}

async function searchHskEntries(rawQuery, limit) {
   const entries = await loadHskSearchIndex();
   const query = classifySearchQuery(rawQuery);
   if (!query.valid) return [];
   return entries
      .filter((entry) => hskEntryMatchesQuery(entry, query))
      .sort((left, right) => compareHskSourceMatches(left, right, query))
      .slice(0, limit || HSK_RESULT_LIMIT);
}

async function mergeHskSearchResults(response, rawQuery) {
   if (!response || !response.query || !response.query.valid) return response;
   const matches = await searchHskEntries(rawQuery, HSK_RESULT_LIMIT);
   const results = response.results || [];
   const dictionaryResultsById = new Map();
   results.forEach((item) => {
      attachHskMetadata(item.entry);
      dictionaryResultsById.set(item.entry.id, item);
   });

   const addedHskIds = new Set();
   for (const hskEntry of matches) {
      const dictionaryResult = hskEntry.dictionaryEntryId
         ? dictionaryResultsById.get(hskEntry.dictionaryEntryId)
         : null;
      if (dictionaryResult) {
         attachHskMetadata(
            dictionaryResult.entry,
            hskDataState.entriesByDictionaryId.get(hskEntry.dictionaryEntryId),
         );
         continue;
      }
      if (addedHskIds.has(hskEntry.hskEntryId)) continue;
      addedHskIds.add(hskEntry.hskEntryId);
      const entry = hskSourceAsDictionaryEntry(hskEntry);
      results.push({
         entry,
         rank: rankDictionaryEntry(entry, response.query, {
            englishFallback: response.englishFallback || hskEntry.firstHskLevel > 1,
         }),
      });
   }

   results.forEach((item) => {
      item.rank = rankDictionaryEntry(item.entry, response.query, {
         englishFallback: response.englishFallback || !!item.entry.__hskSource,
      });
   });
   results.sort(compareRankedDictionaryEntries);
   response.results = results;
   response.hskMatches = matches.length;
   return response;
}

async function loadHskEntryById(hskEntryId) {
   if (hskDataState.entriesById.has(hskEntryId))
      return hskDataState.entriesById.get(hskEntryId);
   await loadHskSearchIndex();
   return hskDataState.entriesById.get(hskEntryId) || null;
}

async function loadHskSearchDetailEntry(entryId) {
   if (!String(entryId).startsWith("hsk:")) {
      const dictionaryEntry = await loadDictionaryEntryById(entryId);
      return attachHskMetadata(dictionaryEntry);
   }
   const hskEntry = await loadHskEntryById(entryId);
   return hskEntry ? hskSourceAsDictionaryEntry(hskEntry) : null;
}

async function openHskVocabularyEntry(entry) {
   if (entry.dictionaryEntryId) {
      try {
         const dictionaryEntry = await loadDictionaryEntryById(entry.dictionaryEntryId);
         if (dictionaryEntry) {
            openDictDetail(attachHskMetadata(dictionaryEntry, [entry]));
            return;
         }
      } catch (error) {
         /* La fiche HSK source reste disponible si le dictionnaire détaillé échoue. */
      }
   }
   openDictDetail(hskSourceAsDictionaryEntry(entry));
}
