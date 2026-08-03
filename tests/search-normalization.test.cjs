"use strict";

const assert = require("node:assert/strict");
const normalization = require("../js/search/normalization.js");
Object.assign(global, normalization);
const ranking = require("../js/search/ranking.js");

const {
   classifySearchQuery,
   normalizePinyinMarked,
   normalizePinyinNumbered,
   normalizePinyinPlain,
   normalizeTranslation,
   normalizeUnicode,
   normalizeVisibleWhitespace,
   numToAccent,
} = normalization;

assert.equal(normalizeUnicode("ni\u030c"), "nǐ");
assert.equal(normalizeVisibleWhitespace("  你\n 好  "), "你 好");
assert.equal(normalizePinyinNumbered("NǏ"), "ni3");
assert.equal(normalizePinyinNumbered("nv3"), "nü3");
assert.equal(normalizePinyinNumbered("nu:3"), "nü3");
assert.equal(normalizePinyinNumbered("LV4"), "lü4");
assert.equal(normalizePinyinNumbered("lu:4"), "lü4");
assert.equal(normalizePinyinMarked("ni3"), "nǐ");
assert.equal(normalizePinyinMarked("nü3"), "nǚ");
assert.equal(normalizePinyinMarked("lü4"), "lǜ");
assert.equal(normalizePinyinPlain("nǐ"), "ni");
assert.equal(normalizePinyinPlain("nv"), "nu");
assert.equal(normalizePinyinPlain("nü"), "nu");
assert.equal(normalizePinyinPlain("lv"), "lu");
assert.equal(normalizePinyinPlain("lü"), "lu");
assert.equal(normalizePinyinNumbered("ma5"), "ma5");
assert.equal(numToAccent("NI3 HAO3"), "nǐ hǎo");
assert.equal(normalizeTranslation("  ÉTUDIER, l’école!  "), "etudier l ecole");
assert.equal(normalizeTranslation("aujourd’hui"), "aujourd hui");

const expectedTypes = new Map([
   ["你", "hanzi-exact"],
   ["你好", "hanzi-word"],
   ["红绿蓝黑白灰棕", "hanzi-word"],
   ["nǐ", "pinyin-marked"],
   ["nǚ", "pinyin-marked"],
   ["lǜ", "pinyin-marked"],
   ["ni3", "pinyin-numbered"],
   ["nv3", "pinyin-numbered"],
   ["nu:3", "pinyin-numbered"],
   ["lv4", "pinyin-numbered"],
   ["lu:4", "pinyin-numbered"],
   ["ni", "pinyin-plain"],
   ["nv", "pinyin-plain"],
   ["nü", "pinyin-plain"],
   ["lv", "pinyin-plain"],
   ["lü", "pinyin-plain"],
   ["tu", "translation"],
   ["toi", "translation"],
   ["bonjour", "translation"],
   ["rouge", "translation"],
   ["apprendre", "translation"],
   ["", "empty"],
   ["   ", "empty"],
   ["...?!", "invalid"],
   ["你 ni3", "mixed"],
   ["🙂", "invalid"],
]);

for (const [input, expected] of expectedTypes) {
   assert.equal(classifySearchQuery(input).type, expected, input);
}

const baseEntries = [
   {
      id: "char-你",
      simplified: "你",
      traditional: "你",
      entryType: "character",
      pinyin: [{ marked: "nǐ", numbered: "ni3", plain: "ni" }],
      definitionsFr: ["tu", "toi"],
      definitionsEn: ["you"],
      sources: ["CFDICT", "CC-CEDICT"],
      hskLegacy: [],
      hsk30: [],
      frequencyRank: null,
   },
   {
      id: "word-ni2",
      simplified: "泥",
      traditional: "泥",
      entryType: "word",
      pinyin: [{ marked: "ní", numbered: "ni2", plain: "ni" }],
      definitionsFr: ["boue"],
      definitionsEn: ["mud"],
      sources: ["CFDICT", "CC-CEDICT"],
      hskLegacy: [],
      hsk30: [],
      frequencyRank: null,
   },
];

const toneQuery = classifySearchQuery("nǐ");
const rankedTone = baseEntries
   .map((entry) => ({ entry, rank: ranking.rankDictionaryEntry(entry, toneQuery, {}) }))
   .sort(ranking.compareRankedDictionaryEntries);
assert.equal(rankedTone[0].entry.simplified, "你");

const hanziQuery = classifySearchQuery("你");
assert.ok(
   ranking.rankDictionaryEntry(baseEntries[0], hanziQuery, {}).score >
      ranking.rankDictionaryEntry({ ...baseEntries[0], simplified: "你好", entryType: "word" }, hanziQuery, {}).score,
);

console.log(`PASS ${expectedTypes.size + 21} normalization and ranking assertions`);
