"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const hskRoot = path.join(projectRoot, "data", "generated", "hsk");
const runtimeRoot = path.join(hskRoot, "runtime");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const clean = readJson(path.join(hskRoot, "hsk-clean.json"));
const links = readJson(path.join(hskRoot, "hsk-dictionary-links.json"));
const manifest = readJson(path.join(runtimeRoot, "manifest.json"));
const dictionaryManifest = readJson(path.join(projectRoot, "data", "generated", "dictionary", "manifest.json"));
const search = readJson(path.join(runtimeRoot, "search-index.json"));

assert.equal(clean.length, 5399);
assert.equal(links.links.length, clean.length);
assert.equal(manifest.format, "mo-studio-hsk-runtime");
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.totalEntries, clean.length);
assert.equal(links.dictionaryBuildId, dictionaryManifest.buildId);
assert.equal(manifest.dictionaryBuildId, dictionaryManifest.buildId);
assert.deepEqual(
   Object.values(manifest.countsByFirstHskLevel).map(Number),
   [301, 200, 499, 1000, 1600, 1799],
);
assert.equal(search.entries.length, clean.length);
assert.deepEqual(search.fields, manifest.fields);

const index = Object.fromEntries(search.fields.map((field, offset) => [field, offset]));
const searchRows = search.entries.map((row) => ({
   id: row[index.hskEntryId],
   chinese: row[index.chinese],
   pinyin: row[index.pinyin],
   firstHskLevel: row[index.firstHskLevel],
   dictionaryEntryId: row[index.dictionaryEntryId],
   dictionaryLinkStatus: row[index.dictionaryLinkStatus],
}));

for (let level = 1; level <= 6; level += 1) {
   const payload = readJson(path.join(runtimeRoot, "levels", `hsk${level}.json`));
   assert.equal(payload.level, level);
   assert.equal(payload.count, manifest.countsByFirstHskLevel[level]);
   assert.equal(payload.entries.length, payload.count);
   const firstLevelIndex = payload.fields.indexOf("firstHskLevel");
   assert.ok(payload.entries.every((row) => row[firstLevelIndex] === level));
}

const love = searchRows.find((entry) => entry.chinese === "爱" && entry.firstHskLevel === 1);
assert.ok(love && love.dictionaryEntryId, "爱 doit être lié au dictionnaire et classé HSK 1");

for (const chinese of ["新媒体", "新能源"]) {
   const entry = searchRows.find((item) => item.chinese === chinese);
   assert.ok(entry, `${chinese} doit être recherchable dans l’index HSK`);
   assert.equal(entry.firstHskLevel, 6);
   assert.equal(entry.dictionaryEntryId, null);
   assert.equal(entry.dictionaryLinkStatus, "source-only");
}

const ambiguous = searchRows.find((entry) => entry.chinese === "嗯" && entry.pinyin === "ǹg");
assert.ok(ambiguous);
assert.equal(ambiguous.dictionaryLinkStatus, "ambiguous");

const integrationSources = [
   fs.readFileSync(path.join(projectRoot, "js", "hsk", "hsk-loader.js"), "utf8"),
   fs.readFileSync(path.join(projectRoot, "js", "views", "path.js"), "utf8"),
].join("\n");
assert.doesNotMatch(
   integrationSources,
   /\bdb\.(?:cards|packs|units)\s*=|\b(?:save|grade|scheduleSrs)\s*\(/u,
   "L’intégration HSK ne doit écrire ni cartes, ni packs, ni unités, ni état SRS.",
);
assert.ok(
   fs.statSync(path.join(runtimeRoot, "search-index.json")).size < 1_000_000,
   "L’index HSK chargé à la demande doit rester compact.",
);
assert.ok(
   fs.statSync(path.join(projectRoot, "js", "hsk", "hsk-loader.js")).size < 30_000,
   "Les 5 399 entrées ne doivent pas être copiées dans le JavaScript.",
);

console.log("PASS HSK runtime: 5 399 entries, six progressive levels, source fallbacks, and read-only learning state");
