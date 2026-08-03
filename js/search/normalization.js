"use strict";

/* Normalisation commune à l'import historique et au dictionnaire hors ligne. */
const PINYIN_TONE_TABLE = {
   a: "āáǎà",
   e: "ēéěè",
   i: "īíǐì",
   o: "ōóǒò",
   u: "ūúǔù",
   ü: "ǖǘǚǜ",
};

const PINYIN_MARK_TO_NUMBER = (() => {
   const output = {};
   Object.entries(PINYIN_TONE_TABLE).forEach(([plain, marked]) => {
      Array.from(marked).forEach((character, index) => {
         output[character] = { plain, tone: index + 1 };
      });
   });
   return output;
})();

const PINYIN_MARK_PATTERN = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
const HAN_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const HAN_ONLY_PATTERN = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+$/u;

/* Les syllabes non tonées ci-dessous sont ambiguës avec des mots français. */
const AMBIGUOUS_FRENCH_PINYIN = new Set([
   "ce",
   "de",
   "le",
   "ma",
   "me",
   "ne",
   "si",
   "te",
   "tu",
]);

const PINYIN_INITIALS = [
   "",
   "b",
   "p",
   "m",
   "f",
   "d",
   "t",
   "n",
   "l",
   "g",
   "k",
   "h",
   "j",
   "q",
   "x",
   "zh",
   "ch",
   "sh",
   "r",
   "z",
   "c",
   "s",
   "y",
   "w",
];

const PINYIN_FINALS = [
   "a", "ai", "an", "ang", "ao", "e", "ei", "en", "eng", "er", "o", "ou",
   "i", "ia", "ian", "iang", "iao", "ie", "in", "ing", "iong", "iu",
   "u", "ua", "uai", "uan", "uang", "ui", "un", "uo",
   "ü", "üe", "üan", "ün",
];

const PINYIN_SYLLABLES = (() => {
   const values = new Set();
   PINYIN_INITIALS.forEach((initial) =>
      PINYIN_FINALS.forEach((final) => values.add(initial + final)),
   );
   ["m", "n", "ng", "hm", "hng", "r"].forEach((value) => values.add(value));
   return values;
})();

function normalizeUnicode(value) {
   return String(value ?? "").normalize("NFC");
}

function normalizeVisibleWhitespace(value) {
   return normalizeUnicode(value).replace(/\s+/gu, " ").trim();
}

function normalizeApostrophes(value) {
   return normalizeUnicode(value).replace(/[’‘ʼ＇]/gu, "'");
}

function normalizePinyinSeparators(value) {
   return normalizeApostrophes(value)
      .toLowerCase()
      .replace(/u:/gu, "ü")
      .replace(/v/gu, "ü")
      .replace(/[\s'·•,;，；。.!?！？、/\\_-]+/gu, " ")
      .trim();
}

function numberedSyllableToMarked(syllable) {
   const match = String(syllable).match(/^([a-züê]+)([1-5])$/iu);
   if (!match) return String(syllable).replace(/v/giu, "ü").replace(/u:/giu, "ü");
   const raw = match[1].replace(/v/giu, "ü").replace(/u:/giu, "ü");
   const tone = Number(match[2]);
   if (tone === 5) return raw;
   const lower = raw.toLowerCase();
   let index = lower.indexOf("a");
   if (index < 0) index = lower.indexOf("e");
   if (index < 0 && lower.includes("ou")) index = lower.indexOf("o");
   if (index < 0) {
      for (let cursor = lower.length - 1; cursor >= 0; cursor--) {
         if ("iouüê".includes(lower[cursor])) {
            index = cursor;
            break;
         }
      }
   }
   if (index < 0) return raw;
   const marked = (PINYIN_TONE_TABLE[lower[index]] || "")[tone - 1];
   return marked ? raw.slice(0, index) + marked + raw.slice(index + 1) : raw;
}

function numToAccent(value) {
   return normalizePinyinSeparators(value)
      .split(" ")
      .filter(Boolean)
      .map(numberedSyllableToMarked)
      .join(" ");
}

function markedSyllableToNumbered(syllable) {
   let tone = 5;
   const plain = Array.from(normalizeUnicode(syllable).toLowerCase())
      .map((character) => {
         const mapped = PINYIN_MARK_TO_NUMBER[character];
         if (!mapped) return character;
         tone = mapped.tone;
         return mapped.plain;
      })
      .join("")
      .replace(/v/gu, "ü")
      .replace(/u:/gu, "ü");
   return plain + (tone === 5 ? "" : tone);
}

function normalizePinyinNumbered(value) {
   return normalizePinyinSeparators(value)
      .split(" ")
      .filter(Boolean)
      .map((syllable) => {
         if (/[1-5]$/u.test(syllable)) return syllable;
         return markedSyllableToNumbered(syllable);
      })
      .join(" ");
}

function normalizePinyinMarked(value) {
   return normalizePinyinSeparators(value)
      .split(" ")
      .filter(Boolean)
      .map((syllable) =>
         /[1-5]$/u.test(syllable)
            ? numberedSyllableToMarked(syllable)
            : normalizeUnicode(syllable),
      )
      .join(" ");
}

function normalizePinyinPlain(value) {
   return normalizePinyinSeparators(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[1-5]/gu, "")
      .replace(/ü/gu, "u")
      .replace(/[^a-z\s]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
}

function normalizeTranslation(value) {
   return normalizeApostrophes(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/['-]+/gu, " ")
      .replace(/[^a-z0-9\s]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
}

function pinyinSyllables(value) {
   return normalizePinyinPlain(value).split(" ").filter(Boolean);
}

function isPinyinSyllable(value) {
   return PINYIN_SYLLABLES.has(String(value || "").toLowerCase());
}

function classifySearchQuery(rawValue) {
   const display = normalizeVisibleWhitespace(rawValue);
   const normalized = normalizeApostrophes(display).toLowerCase();
   const hasHan = HAN_PATTERN.test(normalized);
   const hasLatin = /[a-zà-öø-ÿü]/iu.test(normalized);
   const hasDigits = /\d/u.test(normalized);

   if (!display) return { type: "empty", display, valid: false };
   if (hasHan && (hasLatin || hasDigits))
      return { type: "mixed", display, valid: false };
   if (hasHan) {
      if (!HAN_ONLY_PATTERN.test(normalized))
         return { type: "mixed", display, valid: false };
      const characters = Array.from(normalized);
      return {
         type: characters.length === 1 ? "hanzi-exact" : "hanzi-word",
         display,
         valid: true,
         hanzi: normalized,
         characters,
      };
   }

   if (!hasLatin)
      return { type: "invalid", display, valid: false };
   if (/[^a-zà-öø-ÿüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ0-9:'’‘ʼ＇\s.,;!?·•，；。！？、/\\_-]/iu.test(normalized))
      return { type: "invalid", display, valid: false };

   const marked = PINYIN_MARK_PATTERN.test(normalized);
   const numbered = /[1-5]/u.test(normalized);
   const numberedKey = normalizePinyinNumbered(normalized);
   const markedKey = normalizePinyinMarked(normalized);
   const plainKey = normalizePinyinPlain(normalized);
   const syllables = plainKey.split(" ").filter(Boolean);
   const validPinyin =
      syllables.length > 0 &&
      syllables.every(isPinyinSyllable) &&
      !(!marked && !numbered && syllables.length === 1 && AMBIGUOUS_FRENCH_PINYIN.has(syllables[0]));

   if ((marked || numbered) && !validPinyin)
      return { type: "invalid", display, valid: false };
   if (validPinyin) {
      return {
         type: marked ? "pinyin-marked" : numbered ? "pinyin-numbered" : "pinyin-plain",
         display,
         valid: true,
         marked: markedKey,
         numbered: numberedKey,
         plain: plainKey,
         syllables,
      };
   }

   const translation = normalizeTranslation(normalized);
   if (!translation) return { type: "invalid", display, valid: false };
   return {
      type: "translation",
      display,
      valid: true,
      translation,
      tokens: translation.split(" ").filter(Boolean),
   };
}

function toneOf(syllable) {
   const numbered = normalizePinyinNumbered(syllable);
   const match = numbered.match(/[1-5](?:\s|$)/u);
   return match ? Number(match[0].trim()) : 5;
}

function colorPinyin(pinyin) {
   if (!pinyin) return "";
   if (typeof db !== "undefined" && !db.settings.toneColors) return esc(pinyin);
   return String(pinyin)
      .split(/(\s+)/u)
      .map((part) => {
         if (!/[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/iu.test(part)) return esc(part);
         return '<span class="tn t' + toneOf(part) + '">' + esc(part) + "</span>";
      })
      .join("");
}

/* Compatibilité des anciens appels internes. */
const toneless = normalizePinyinPlain;
const toneKey = normalizePinyinMarked;
const pySyllables = (value) => normalizeVisibleWhitespace(value).split(" ").filter(Boolean);
const classifyQuery = (value) => classifySearchQuery(value).type;

if (typeof module !== "undefined" && module.exports) {
   module.exports = {
      classifySearchQuery,
      isPinyinSyllable,
      normalizeApostrophes,
      normalizePinyinMarked,
      normalizePinyinNumbered,
      normalizePinyinPlain,
      normalizeTranslation,
      normalizeUnicode,
      normalizeVisibleWhitespace,
      numToAccent,
      toneOf,
   };
}
