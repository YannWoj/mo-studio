"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const generated = path.join(root, "data", "generated", "dictionary");
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const stableWordId = (traditional, simplified, numbered) =>
   "word-" + sha256(JSON.stringify([traditional, simplified, numbered])).slice(0, 24);
const charChunk = (id) => sha256(id).slice(0, 2);
const wordChunk = (id) => id.slice(5, 7);
const entryById = (id) => {
   const key = id.startsWith("word-") ? wordChunk(id) : charChunk(id);
   return readJson(path.join(generated, "entries", `${key}.json`)).entries.find((entry) => entry.id === id);
};
const word = (traditional, simplified, numbered) => entryById(stableWordId(traditional, simplified, numbered));

const manifest = readJson(path.join(generated, "manifest.json"));
const audit = readJson(path.join(generated, "french-audit-report.json"));
const overridesPath = path.join(root, "data", "source", "dictionary-fr-overrides.json");
const overrides = readJson(overridesPath);

assert.equal(manifest.schemaVersion, 2);
assert.equal(manifest.frenchEditorialPolicy.entryCount, 6);
assert.equal(manifest.frenchEditorialPolicy.sha256, sha256(fs.readFileSync(overridesPath)));
assert.equal(audit.status, "PASS");
assert.deepEqual(audit.criticalIssues, []);
assert.equal(audit.corrections.verifiedOverrideCount, 5);
assert.equal(audit.corrections.changedEntryCount, 6);
assert.equal(audit.quarantine.entryCount, 1);
assert.equal(audit.englishWithoutVerifiedFrench.count, audit.englishWithoutVerifiedFrench.items.length);
assert.equal(audit.coverage.overallWordsBeforePolicy.covered, 60424);
assert.equal(audit.coverage.overallWordsAfterPolicy.covered, 60425);

assert.equal(sha256(fs.readFileSync(path.join(root, "data", "source", "cfdict.u8"))), "e1e2891a7bedb347e7a39888274727368a529ab9600262a5290085ef8a61d3f4");
assert.equal(sha256(fs.readFileSync(path.join(root, "data", "source", "cc-cedict.u8"))), "36062be89f98c5730eb0bdb6dcc7a874c088975a960ee21c5231827aedb89b2a");

const mao = word("毛", "毛", "mao2");
assert(mao.definitionsFr.includes("poil") && mao.definitionsFr.includes("plume") && mao.definitionsFr.includes("laine"));
assert(!mao.definitionsFr.includes("Torr"));

const tuo = word("乇", "乇", "tuo1");
const zhe = word("乇", "乇", "zhe2");
assert.deepEqual(tuo.definitionsFr, ["ancienne variante de 托"]);
assert.deepEqual(zhe.definitionsFr, ["composant graphique « brin d’herbe »"]);
assert(!zhe.definitionsFr.includes("Torr"));

const zhong = word("乑", "乑", "zhong4");
assert.deepEqual(zhong.definitionsFr, ["se tenir côte à côte", "variante de 眾/众"]);
const alkene = word("烯", "烯", "xi1");
assert.deepEqual(alkene.definitionsFr, ["alcène"]);
assert(!alkene.definitionsFr.some((definition) => /blaze|glorieux/iu.test(definition)));
const jue = word("叕", "叕", "jue2");
assert.deepEqual(jue.definitionsFr, []);
assert.equal(jue.frenchStatus, "unavailable");

const zheCharacter = entryById("char-乇");
assert.deepEqual(zheCharacter.pinyin.map((item) => item.numbered), ["tuo1"]);
assert.deepEqual(zheCharacter.definitionsFr, ["ancienne variante de 托"]);
assert.deepEqual(zheCharacter.readings.map((reading) => reading.pinyin.numbered), ["tuo1", "zhe2"]);
assert(zheCharacter.readings.find((reading) => reading.pinyin.numbered === "zhe2").definitionsFr.includes("composant graphique « brin d’herbe »"));
const duoCharacter = entryById("char-叕");
assert.equal(duoCharacter.readings.find((reading) => reading.pinyin.numbered === "jue2").frenchStatus, "unavailable");

const locations = readJson(path.join(generated, "entry-locations.json"));
const frenchIndex = readJson(path.join(generated, "french-index.json"));
const jueReference = locations.findIndex(([id]) => id === jue.id);
assert(!((frenchIndex.vitesse || []).includes(jueReference)));
assert(overrides.entries.every((entry) => entry.justification && entry.references.length && /^\d{4}-\d{2}-\d{2}$/.test(entry.verifiedAt)));

console.log("dictionary French quality data tests: PASS");
