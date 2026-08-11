"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative));
const readJson = (relative) => JSON.parse(read(relative).toString("utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const scripts = (relative) => [...read(relative).toString("utf8").matchAll(
   /<script data-mo-app src="([^"]+)"><\/script>/gu,
)].map((match) => match[1]);

const indexScripts = scripts("index.html");
const compatibilityScripts = scripts("mo-studio.html");
assert.deepEqual(
   compatibilityScripts,
   indexScripts,
   "index.html and mo-studio.html must load the exact same application scripts in the same order",
);
for (const expected of [
   "js/dictionary/dictionary-loader.js?runtime=5",
   "js/search/search-engine.js?runtime=5",
   "js/strokes/character-radicals-loader.js?runtime=2",
   "js/search/radical-browser.js?runtime=2",
]) assert(indexScripts.includes(expected), `missing versioned runtime resource ${expected}`);

const dictionary = readJson("data/generated/dictionary/manifest.json");
const radicals = readJson("data/generated/character-radicals/manifest.json");
assert.equal(dictionary.schemaVersion, 5);
assert.equal(radicals.schemaVersion, 2);
assert.equal(radicals.derivedFrom.dictionaryBuildId, dictionary.buildId);

const dictionaryFiles = new Map(dictionary.files.map((descriptor) => [descriptor.path, descriptor]));
const requiredDictionaryPaths = [
   dictionary.entryLocations,
   dictionary.searchPreviews,
   dictionary.attribution,
   ...Object.values(dictionary.indexes),
   ...dictionary.chunks.map((chunk) => chunk.path),
];
assert(requiredDictionaryPaths.every((relative) => dictionaryFiles.has(relative)));

const radicalRow = radicals.radicals.find((row) => row.radical === "卩");
assert(radicalRow, "卩 missing from the radical manifest");
assert.equal(radicalRow.memberCount, 11);
const radicalBytes = read(path.posix.join("data/generated/character-radicals", radicalRow.path));
assert.equal(radicalBytes.length, radicalRow.bytes);
assert.equal(sha256(radicalBytes), radicalRow.sha256);
const radicalChunk = JSON.parse(radicalBytes.toString("utf8"));
assert.equal(radicalChunk.characters.length, 11);

for (const relative of [
   dictionary.entryLocations,
   dictionary.searchPreviews,
   dictionary.indexes.characters,
   "entries/c6.json",
]) {
   const descriptor = dictionaryFiles.get(relative);
   const bytes = read(path.posix.join("data/generated/dictionary", relative));
   assert.equal(bytes.length, descriptor.sizeBytes, `${relative}: size mismatch`);
   assert.equal(sha256(bytes), descriptor.sha256, `${relative}: sha256 mismatch`);
}

for (const relative of ["index.html", "mo-studio.html", ...indexScripts.map((url) => url.split("?")[0])]) {
   const text = read(relative).toString("utf8");
   assert(!/serviceWorker\s*\.\s*register\s*\(/u.test(text), `${relative}: unexpected service worker registration`);
}

console.log("runtime/data generation coherence tests: PASS");
