import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const hskDirectory = path.join(projectRoot, "data", "generated", "hsk");
const runtimeDirectory = path.join(hskDirectory, "runtime");
const levelsDirectory = path.join(runtimeDirectory, "levels");

const clean = JSON.parse(await readFile(path.join(hskDirectory, "hsk-clean.json"), "utf8"));
const linksDocument = JSON.parse(
   await readFile(path.join(hskDirectory, "hsk-dictionary-links.json"), "utf8"),
);

if (!Array.isArray(clean) || clean.length !== 5399) {
   throw new Error("hsk-clean.json doit contenir exactement 5 399 entrées finales.");
}
if (!linksDocument || !Array.isArray(linksDocument.links)) {
   throw new Error("hsk-dictionary-links.json est invalide.");
}

const linksById = new Map(linksDocument.links.map((link) => [link.hskEntryId, link]));
if (linksById.size !== clean.length) {
   throw new Error("La table de liaison HSK ne couvre pas toutes les entrées finales.");
}

const fields = [
   "hskEntryId",
   "chinese",
   "pinyin",
   "hskLevel",
   "firstHskLevel",
   "sourceLevels",
   "partOfSpeech",
   "sourceTranslation",
   "dictionaryEntryId",
   "dictionaryLinkStatus",
   "senseId",
   "baseDictionaryLinkStatus",
   "selectedPronunciationMarked",
   "selectedPronunciationNumbered",
   "selectedPronunciationPlain",
];

const rows = clean.map((entry) => {
   const link = linksById.get(entry.hskEntryId);
   if (!link) throw new Error(`Liaison absente pour ${entry.hskEntryId}`);
   if (
      entry.dictionaryEntryId !== link.dictionaryEntryId ||
      entry.dictionaryLinkStatus !== link.dictionaryLinkStatus
   ) {
      throw new Error(`Liaison incohérente pour ${entry.hskEntryId}`);
   }
   const selected = link.selectedDictionaryPronunciation || {};
   return [
      entry.hskEntryId,
      entry.chinese,
      entry.pinyin,
      entry.hskLevel,
      entry.firstHskLevel,
      entry.sourceLevels,
      entry.partOfSpeech,
      entry.sourceTranslation,
      entry.dictionaryEntryId,
      entry.dictionaryLinkStatus,
      entry.senseId,
      link.baseDictionaryLinkStatus || entry.baseDictionaryLinkStatus || entry.dictionaryLinkStatus,
      selected.marked || null,
      selected.numbered || null,
      selected.plain || null,
   ];
});

const countsByLevel = {};
const statusCounts = {};
for (let level = 1; level <= 6; level += 1) {
   countsByLevel[level] = rows.filter((row) => row[4] === level).length;
}
for (const entry of clean) {
   statusCounts[entry.dictionaryLinkStatus] =
      (statusCounts[entry.dictionaryLinkStatus] || 0) + 1;
}

const expectedCounts = [301, 200, 499, 1000, 1600, 1799];
for (let level = 1; level <= 6; level += 1) {
   if (countsByLevel[level] !== expectedCounts[level - 1]) {
      throw new Error(`Compte HSK ${level} inattendu: ${countsByLevel[level]}`);
   }
}

await mkdir(levelsDirectory, { recursive: true });

const serialize = (value) => `${JSON.stringify(value)}\n`;
await writeFile(
   path.join(runtimeDirectory, "search-index.json"),
   serialize({ schemaVersion: 1, fields, entries: rows }),
   "utf8",
);

for (let level = 1; level <= 6; level += 1) {
   await writeFile(
      path.join(levelsDirectory, `hsk${level}.json`),
      serialize({
         schemaVersion: 1,
         level,
         firstHskLevel: level,
         count: countsByLevel[level],
         fields,
         entries: rows.filter((row) => row[4] === level),
      }),
      "utf8",
   );
}

const manifest = {
   format: "mo-studio-hsk-runtime",
   schemaVersion: 1,
   generatedOn: linksDocument.generatedOn || null,
   dictionaryBuildId: linksDocument.dictionaryBuildId || null,
   totalEntries: rows.length,
   countsByFirstHskLevel: countsByLevel,
   statusCounts,
   fields,
   searchIndex: "search-index.json",
   levelPathTemplate: "levels/hsk{level}.json",
   sourceFiles: ["../hsk-clean.json", "../hsk-dictionary-links.json"],
};

await writeFile(path.join(runtimeDirectory, "manifest.json"), serialize(manifest), "utf8");
console.log(
   JSON.stringify(
      {
         output: path.relative(projectRoot, runtimeDirectory),
         totalEntries: rows.length,
         countsByFirstHskLevel: countsByLevel,
         statusCounts,
      },
      null,
      2,
   ),
);
