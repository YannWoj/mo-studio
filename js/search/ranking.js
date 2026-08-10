"use strict";

/* Scores positifs : plus le score est élevé, plus le résultat est pertinent. */
const SEARCH_WEIGHTS = Object.freeze({
   EXACT_SIMPLIFIED: 16000,
   EXACT_TRADITIONAL: 15000,
   EXACT_CHINESE_WORD: 1800,
   EXACT_CHARACTER: 900,
   EXACT_PINYIN_MARKED: 14800,
   EXACT_PINYIN_NUMBERED: 14600,
   EXACT_PINYIN_PLAIN: 11600,
   PINYIN_PREFIX: 4400,
   HANZI_PREFIX: 6900,
   HANZI_CONTAINS: 3200,
   EXACT_FRENCH_TOKEN: 7800,
   FRENCH_PREFIX_TOKEN: 4200,
   ENGLISH_FALLBACK: 2300,
   PERSONAL_CARD: 1500,
   CHARACTER_TYPE: 0,
   VERIFIED_HSK: 420,
   VERIFIED_FREQUENCY_MAX: 600,
   FRENCH_DEFINITION: 520,
   ENGLISH_DEFINITION: 45,
   SOURCE_COMPLETENESS: 35,
   WORD_LENGTH_PENALTY: 9,
});

function dictionaryVariantStatus(entry) {
   const definitions = [...entryDefinitions(entry, "fr"), ...entryDefinitions(entry, "en")].join(" ");
   if (/\b(?:archaic|ancient|old)\s+(?:variant|form)\b|\bforme\s+ancienne\b/iu.test(definitions))
      return "ancient";
   if (/\bvariant(?:e)?\s+(?:of|de)\b|\bvariant\b/iu.test(definitions)) return "variant";
   if (entry.__scriptVariant) return "script-variant";
   return "modern";
}

function dictionaryExactSortTier(entry, query) {
   const simplified = entry.simplified || entry.hz || "";
   const traditional = entry.traditional || simplified;
   const exact = simplified === query.hanzi || traditional === query.hanzi;
   if (!query.type.startsWith("hanzi") || !exact) return null;
   const entryType = entry.entryType || (Array.from(simplified).length === 1 ? "character" : "word");
   const variant = dictionaryVariantStatus(entry) !== "modern";
   if (entryType === "word" && !variant && entryDefinitions(entry, "fr").length) return 0;
   if (verifiedHskLevel(entry) != null) return 1;
   if (entryType === "character") return 2;
   if (!variant) return 3;
   return 4;
}

function dictionaryPinyinSortTier(entry, query) {
   if (!query.type.startsWith("pinyin")) return null;
   let tier = 4;
   entryPinyinVariants(entry).forEach((variant) => {
      const marked = normalizePinyinMarked(variant.marked || variant.numbered || "");
      const numbered = normalizePinyinNumbered(variant.numbered || variant.marked || "");
      const plain = normalizePinyinPlain(variant.plain || variant.numbered || variant.marked || "");
      if (query.type === "pinyin-marked" && marked === query.marked) tier = Math.min(tier, 0);
      else if (query.type === "pinyin-numbered" && numbered === query.numbered) tier = Math.min(tier, 0);
      else if (plain === query.plain) tier = Math.min(tier, 1);
      else if (marked.startsWith(query.marked) || numbered.startsWith(query.numbered) || plain.startsWith(query.plain))
         tier = Math.min(tier, 3);
   });
   return tier;
}

function entryPinyinVariants(entry) {
   if (Array.isArray(entry.readings) && entry.readings.length)
      return entry.readings.map((reading) => reading.pinyin).filter(Boolean);
   if (Array.isArray(entry.pinyin)) return entry.pinyin;
   if (entry.py) {
      return [
         {
            marked: normalizePinyinMarked(entry.py),
            numbered: normalizePinyinNumbered(entry.py),
            plain: normalizePinyinPlain(entry.py),
         },
      ];
   }
   return [];
}

function entryDefinitions(entry, language) {
   if (Array.isArray(entry.readings) && entry.readings.length) {
      const field = language === "fr" ? "definitionsFr" : "definitionsEn";
      return Array.from(new Set(entry.readings.flatMap((reading) => reading[field] || [])));
   }
   if (language === "fr")
      return Array.isArray(entry.definitionsFr)
         ? entry.definitionsFr
         : entry.fr
           ? [entry.fr]
           : [];
   return Array.isArray(entry.definitionsEn) ? entry.definitionsEn : [];
}

function entryHanziLength(entry) {
   return Array.from(entry.simplified || entry.hz || "").length;
}

function verifiedHskLevel(entry) {
   const levels = [
      ...(Array.isArray(entry.hskVerified)
         ? entry.hskVerified.map((item) => item.firstHskLevel ?? item.level)
         : []),
      ...(Array.isArray(entry.hskLegacy) ? entry.hskLegacy : []),
      ...(Array.isArray(entry.hsk30) ? entry.hsk30 : []),
   ].filter((value) => Number.isFinite(Number(value)));
   return levels.length ? Math.min(...levels.map(Number)) : null;
}

function normalizedDefinitionTokens(entry, language) {
   return entryDefinitions(entry, language).flatMap((definition) =>
      normalizeTranslation(definition).split(" ").filter(Boolean),
   );
}

function rankDictionaryEntry(entry, query, context) {
   const simplified = entry.simplified || entry.hz || "";
   const traditional = entry.traditional || simplified;
   const entryType = entry.entryType || (Array.from(simplified).length === 1 ? "character" : "word");
   const factors = [];
   let score = 0;
   const add = (name, value, explanation) => {
      if (!value) return;
      score += value;
      factors.push({ name, value, explanation });
   };

   if (query.type.startsWith("hanzi")) {
      if (simplified === query.hanzi)
         add("exactSimplified", SEARCH_WEIGHTS.EXACT_SIMPLIFIED, "forme simplifiée exacte");
      else if (traditional === query.hanzi)
         add("exactTraditional", SEARCH_WEIGHTS.EXACT_TRADITIONAL, "forme traditionnelle exacte");
      else if (simplified.startsWith(query.hanzi) || traditional.startsWith(query.hanzi))
         add("hanziPrefix", SEARCH_WEIGHTS.HANZI_PREFIX, "commence par la recherche");
      else if (simplified.includes(query.hanzi) || traditional.includes(query.hanzi))
         add("hanziContains", SEARCH_WEIGHTS.HANZI_CONTAINS, "contient la recherche");

      if ((simplified === query.hanzi || traditional === query.hanzi) && entryType === "character")
         add("exactCharacter", SEARCH_WEIGHTS.EXACT_CHARACTER, "caractère exact");
      if ((simplified === query.hanzi || traditional === query.hanzi) && entryType === "word")
         add("exactWord", SEARCH_WEIGHTS.EXACT_CHINESE_WORD, "mot exact");
   }

   if (query.type.startsWith("pinyin")) {
      let pinyinScore = 0;
      let pinyinExplanation = "";
      entryPinyinVariants(entry).forEach((variant) => {
         const marked = normalizePinyinMarked(variant.marked || variant.numbered || "");
         const numbered = normalizePinyinNumbered(variant.numbered || variant.marked || "");
         const plain = normalizePinyinPlain(variant.plain || variant.numbered || variant.marked || "");
         let candidate = 0;
         let explanation = "";
         if (query.type === "pinyin-marked" && marked === query.marked) {
            candidate = SEARCH_WEIGHTS.EXACT_PINYIN_MARKED;
            explanation = "pinyin accentué exact";
         } else if (query.type === "pinyin-numbered" && numbered === query.numbered) {
            candidate = SEARCH_WEIGHTS.EXACT_PINYIN_NUMBERED;
            explanation = "pinyin numéroté exact";
         } else if (plain === query.plain) {
            candidate = SEARCH_WEIGHTS.EXACT_PINYIN_PLAIN;
            explanation = "pinyin sans ton exact";
         } else if (
            marked.startsWith(query.marked) ||
            numbered.startsWith(query.numbered) ||
            plain.startsWith(query.plain)
         ) {
            candidate = SEARCH_WEIGHTS.PINYIN_PREFIX;
            explanation = "préfixe pinyin";
         }
         if (candidate > pinyinScore) {
            pinyinScore = candidate;
            pinyinExplanation = explanation;
         }
      });
      add("pinyin", pinyinScore, pinyinExplanation);
   }

   if (query.type === "translation") {
      const frenchTokens = normalizedDefinitionTokens(entry, "fr");
      const englishTokens = normalizedDefinitionTokens(entry, "en");
      const tokens = query.tokens || [];
      const exactFrench = tokens.length > 0 && tokens.every((token) => frenchTokens.includes(token));
      const prefixFrench =
         !exactFrench &&
         tokens.length > 0 &&
         tokens.every((token) => frenchTokens.some((word) => word.startsWith(token)));
      if (exactFrench)
         add("exactFrench", SEARCH_WEIGHTS.EXACT_FRENCH_TOKEN, "mot français exact");
      else if (prefixFrench)
         add("frenchPrefix", SEARCH_WEIGHTS.FRENCH_PREFIX_TOKEN, "préfixe français");
      else if (context && context.englishFallback) {
         const exactEnglish = tokens.length > 0 && tokens.every((token) => englishTokens.includes(token));
         if (exactEnglish)
            add("englishFallback", SEARCH_WEIGHTS.ENGLISH_FALLBACK, "repli anglais");
      }
   }

   if (entry.personalCard || entry.src === "card")
      add("personalCard", SEARCH_WEIGHTS.PERSONAL_CARD, "déjà dans Mes mots");
   if (entryType === "character")
      add("characterType", SEARCH_WEIGHTS.CHARACTER_TYPE, "entrée caractère");

   const hskLevel = verifiedHskLevel(entry);
   if (hskLevel != null)
      add("verifiedHsk", Math.max(30, SEARCH_WEIGHTS.VERIFIED_HSK - hskLevel * 35), "niveau HSK vérifié");

   if (Number.isFinite(entry.frequencyRank) && entry.frequencyRank > 0) {
      const frequencyScore = Math.max(
         1,
         Math.round(SEARCH_WEIGHTS.VERIFIED_FREQUENCY_MAX / Math.log2(entry.frequencyRank + 2)),
      );
      add("verifiedFrequency", frequencyScore, "fréquence vérifiée");
   }

   const french = entryDefinitions(entry, "fr");
   const english = entryDefinitions(entry, "en");
   if (french.length) add("frenchDefinition", SEARCH_WEIGHTS.FRENCH_DEFINITION, "définition française disponible");
   if (english.length) add("englishDefinition", SEARCH_WEIGHTS.ENGLISH_DEFINITION, "définition anglaise disponible");
   add(
      "sourceCompleteness",
      Math.min(Array.isArray(entry.sources) ? entry.sources.length : 0, 2) * SEARCH_WEIGHTS.SOURCE_COMPLETENESS,
      "sources concordantes",
   );
   score -= entryHanziLength(entry) * SEARCH_WEIGHTS.WORD_LENGTH_PENALTY;

   const exactTier = dictionaryExactSortTier(entry, query);
   const pinyinTier = dictionaryPinyinSortTier(entry, query);
   const sortTier = exactTier != null
      ? exactTier
      : pinyinTier != null
        ? pinyinTier + (pinyinTier <= 1 && verifiedHskLevel(entry) == null ? 0.5 : 0)
        : query.type.startsWith("hanzi")
          ? simplified.startsWith(query.hanzi) || traditional.startsWith(query.hanzi) ? 5 : 6
          : 0;

   return {
      score,
      sortTier,
      factors,
      explanation: factors.length ? factors[0].explanation : "correspondance indexée",
   };
}

function compareRankedDictionaryEntries(left, right) {
   return (
      (left.rank.sortTier ?? 0) - (right.rank.sortTier ?? 0) ||
      right.rank.score - left.rank.score ||
      Number(!!right.entry.personalCard) - Number(!!left.entry.personalCard) ||
      entryHanziLength(left.entry) - entryHanziLength(right.entry) ||
      Number(entryDefinitions(right.entry, "fr").length > 0) -
         Number(entryDefinitions(left.entry, "fr").length > 0) ||
      String(left.entry.simplified || left.entry.hz).localeCompare(
         String(right.entry.simplified || right.entry.hz),
         "zh",
      ) ||
      String(left.entry.id || left.entry.cardId || "").localeCompare(
         String(right.entry.id || right.entry.cardId || ""),
      )
   );
}

if (typeof module !== "undefined" && module.exports) {
   module.exports = {
      SEARCH_WEIGHTS,
      compareRankedDictionaryEntries,
      dictionaryVariantStatus,
      rankDictionaryEntry,
   };
}
