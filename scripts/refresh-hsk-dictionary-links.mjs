import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const dictionaryDirectory = path.join(projectRoot, "data", "generated", "dictionary");
const hskDirectory = path.join(projectRoot, "data", "generated", "hsk");
const checkOnly = process.argv.includes("--check");

const readJson = async (filename) => JSON.parse(await readFile(filename, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function requireValue(condition, message) {
   if (!condition) throw new Error(message);
}

function replaceSingle(text, pattern, replacement, label) {
   const matches = text.match(pattern);
   requireValue(matches?.length === 1, `${label} : remplacement attendu exactement une fois`);
   return text.replace(pattern, replacement);
}

const dictionaryManifestPath = path.join(dictionaryDirectory, "manifest.json");
const dictionaryManifestBuffer = await readFile(dictionaryManifestPath);
const dictionaryManifest = JSON.parse(dictionaryManifestBuffer.toString("utf8"));
const entryLocations = await readJson(
   path.join(dictionaryDirectory, dictionaryManifest.entryLocations),
);
const locationById = new Map(entryLocations.map(([id, chunk]) => [id, chunk]));

const linksPath = path.join(hskDirectory, "hsk-dictionary-links.json");
const linksDocument = await readJson(linksPath);
const clean = await readJson(path.join(hskDirectory, "hsk-clean.json"));
requireValue(Array.isArray(linksDocument.links) && linksDocument.links.length === 5399, "Les liaisons HSK doivent contenir 5 399 entrées");
requireValue(Array.isArray(clean) && clean.length === 5399, "hsk-clean.json doit contenir 5 399 entrées");

const cleanById = new Map(clean.map((entry) => [entry.hskEntryId, entry]));
const selectedIds = new Set(
   linksDocument.links.map((link) => link.dictionaryEntryId).filter(Boolean),
);
const wantedByChunk = new Map();
for (const id of selectedIds) {
   const chunk = locationById.get(id);
   requireValue(chunk, `Entrée de dictionnaire HSK absente : ${id}`);
   if (!wantedByChunk.has(chunk)) wantedByChunk.set(chunk, new Set());
   wantedByChunk.get(chunk).add(id);
}

const selectedEntries = new Map();
for (const [chunk, wanted] of wantedByChunk) {
   const payload = await readJson(path.join(dictionaryDirectory, "entries", `${chunk}.json`));
   for (const entry of payload.entries) {
      if (wanted.has(entry.id)) selectedEntries.set(entry.id, entry);
   }
}
requireValue(selectedEntries.size === selectedIds.size, "Certaines liaisons HSK ne se résolvent pas dans les chunks");

const statusCounts = {};
for (const link of linksDocument.links) {
   const cleaned = cleanById.get(link.hskEntryId);
   requireValue(cleaned, `Entrée nettoyée absente : ${link.hskEntryId}`);
   requireValue(cleaned.chinese === link.chinese && cleaned.pinyin === link.pinyin, `Texte HSK incohérent : ${link.hskEntryId}`);
   requireValue(cleaned.dictionaryEntryId === link.dictionaryEntryId, `Identifiant dictionnaire incohérent : ${link.hskEntryId}`);
   requireValue(cleaned.dictionaryLinkStatus === link.dictionaryLinkStatus, `Statut dictionnaire incohérent : ${link.hskEntryId}`);
   statusCounts[link.dictionaryLinkStatus] = (statusCounts[link.dictionaryLinkStatus] || 0) + 1;
   if (!link.dictionaryEntryId) continue;

   const entry = selectedEntries.get(link.dictionaryEntryId);
   requireValue(entry?.entryType === "word", `La liaison HSK ne cible pas un mot : ${link.hskEntryId}`);
   requireValue(
      link.chinese === entry.simplified || link.chinese === entry.traditional,
      `La graphie HSK ne correspond pas à son mot : ${link.hskEntryId}`,
   );
   const selectedNumbered = link.selectedDictionaryPronunciation?.numbered;
   requireValue(
      !selectedNumbered || entry.pinyin.some((pinyin) => pinyin.numbered === selectedNumbered),
      `La lecture HSK ne correspond pas à son mot : ${link.hskEntryId}`,
   );
}

const current = {
   buildId: dictionaryManifest.buildId,
   builderVersion: dictionaryManifest.builderVersion,
   schemaVersion: dictionaryManifest.schemaVersion,
   manifestSha256: sha256(dictionaryManifestBuffer),
   entryCount: entryLocations.length,
   exactHanziIndexKeyCount: Object.keys(
      await readJson(path.join(dictionaryDirectory, dictionaryManifest.indexes.exactHanzi)),
   ).length,
};

if (checkOnly) {
   requireValue(linksDocument.dictionaryBuildId === current.buildId, "Les liaisons HSK ciblent une ancienne buildId du dictionnaire");
   const runtime = await readJson(path.join(hskDirectory, "runtime", "manifest.json"));
   requireValue(runtime.dictionaryBuildId === current.buildId, "Le runtime HSK cible une ancienne buildId du dictionnaire");
} else {
   const oldBuildId = linksDocument.dictionaryBuildId;
   requireValue(typeof oldBuildId === "string" && oldBuildId, "La buildId HSK précédente est absente");

   const textUpdates = [
      [
         linksPath,
         (text) => replaceSingle(
            text,
            new RegExp(`"dictionaryBuildId": "${oldBuildId}"`, "g"),
            `"dictionaryBuildId": "${current.buildId}"`,
            "hsk-dictionary-links.json",
         ),
      ],
      [
         path.join(hskDirectory, "dictionary-link-report.json"),
         (text) => {
            let output = replaceSingle(text, new RegExp(`"build_id": "${oldBuildId}"`, "g"), `"build_id": "${current.buildId}"`, "dictionary-link-report build_id");
            const report = JSON.parse(text);
            output = replaceSingle(output, new RegExp(`"manifest_sha256": "${report.dictionary.manifest_sha256}"`, "g"), `"manifest_sha256": "${current.manifestSha256}"`, "dictionary-link-report manifest_sha256");
            output = replaceSingle(output, new RegExp(`"builder_version": "${report.dictionary.builder_version}"`, "g"), `"builder_version": "${current.builderVersion}"`, "dictionary-link-report builder_version");
            output = replaceSingle(output, new RegExp(`"schema_version": ${report.dictionary.schema_version}`, "g"), `"schema_version": ${current.schemaVersion}`, "dictionary-link-report schema_version");
            output = replaceSingle(output, new RegExp(`"entry_count": ${report.dictionary.entry_count}`, "g"), `"entry_count": ${current.entryCount}`, "dictionary-link-report entry_count");
            output = replaceSingle(output, new RegExp(`"exact_hanzi_index_key_count": ${report.dictionary.exact_hanzi_index_key_count}`, "g"), `"exact_hanzi_index_key_count": ${current.exactHanziIndexKeyCount}`, "dictionary-link-report exact index count");
            return output;
         },
      ],
      [
         path.join(hskDirectory, "hsk-cleanup-report.json"),
         (text) => {
            let output = replaceSingle(text, new RegExp(`"buildId": "${oldBuildId}"`, "g"), `"buildId": "${current.buildId}"`, "hsk-cleanup-report buildId");
            const report = JSON.parse(text);
            output = replaceSingle(output, new RegExp(`"schemaVersion": ${report.dictionary.schemaVersion}`, "g"), `"schemaVersion": ${current.schemaVersion}`, "hsk-cleanup-report schemaVersion");
            return output;
         },
      ],
      [path.join(hskDirectory, "dictionary-link-report.md"), (text) => replaceSingle(text, new RegExp(oldBuildId, "g"), current.buildId, "dictionary-link-report.md")],
      [path.join(hskDirectory, "hsk-cleanup-report.md"), (text) => replaceSingle(text, new RegExp(oldBuildId, "g"), current.buildId, "hsk-cleanup-report.md")],
   ];
   for (const [filename, update] of textUpdates) {
      const text = await readFile(filename, "utf8");
      await writeFile(filename, update(text), "utf8");
   }
}

console.log(JSON.stringify({
   status: "PASS",
   mode: checkOnly ? "check" : "refresh",
   dictionary: current,
   hskEntries: linksDocument.links.length,
   selectedDictionaryEntries: selectedEntries.size,
   statusCounts,
}, null, 2));
