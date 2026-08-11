"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const generated = path.join(root, "data", "generated", "dictionary-french-editorial");
const dictionaryRoot = path.join(root, "data", "generated", "dictionary");
const readJson = (filename) => JSON.parse(fs.readFileSync(filename, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const runBuilder = (args) => {
   const result = spawnSync("python", ["scripts/build_dictionary_french_editorial.py", ...args], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
   });
   assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
   return result;
};

const manifest = readJson(path.join(generated, "manifest.json"));
const inventory = readJson(path.join(generated, "inventory.json"));
const review = readJson(path.join(generated, "review-queue.json"));
const conflicts = readJson(path.join(generated, "conflicts.json"));
const audit = readJson(path.join(generated, "audit-report.json"));
const batch = readJson(path.join(generated, "batches", "batch-0001.json"));
const dictionaryManifest = readJson(path.join(dictionaryRoot, "manifest.json"));
const dictionaryAudit = readJson(path.join(dictionaryRoot, "french-audit-report.json"));

assert.equal(manifest.format, "mo-studio-french-editorial-inventory");
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.dictionaryBuildId, dictionaryManifest.buildId);
assert.equal(inventory.dictionaryBuildId, dictionaryManifest.buildId);
assert.equal(review.dictionaryBuildId, dictionaryManifest.buildId);
assert.equal(conflicts.dictionaryBuildId, dictionaryManifest.buildId);
assert.equal(audit.dictionaryBuildId, dictionaryManifest.buildId);
assert.equal(batch.dictionaryBuildId, dictionaryManifest.buildId);
assert.equal(audit.staleDictionaryBuildDependencies.staleCount, 0);
assert(audit.staleDictionaryBuildDependencies.items.every((item) => item.current));

assert.equal(inventory.candidateCount, inventory.candidates.length);
assert.equal(review.count, review.items.length);
assert.equal(review.count, 210);
assert.deepEqual(audit.hskFrenchReuse.pendingReviewByStatus, {
   ambiguous: 82,
   "duplicate-sense": 126,
   "source-only": 2,
});
assert.equal(conflicts.count, 186);
assert.equal(dictionaryAudit.hskFrenchReuse.automaticImportCount, 10);
assert.equal(dictionaryAudit.hskFrenchReuse.nonFrenchSourceCandidateCount, 161);
assert.equal(new Set(dictionaryAudit.hskFrenchReuse.nonFrenchSourceCandidates.map((item) => item.dictionaryEntryId)).size, 156);

assert(batch.count <= 40);
assert.equal(batch.maxEntries, 40);
assert.deepEqual(
   batch.entries.map((entry) => entry.candidateId),
   inventory.candidates.filter((entry) => entry.state === "candidate").slice(0, 40).map((entry) => entry.candidateId),
);
assert(batch.entries.every((entry) => entry.state === "candidate"));
assert(inventory.candidates.every((entry) => {
   const identity = entry.lexicalIdentity;
   return identity.traditional && identity.simplified && identity.pinyinNumbered &&
      entry.pinyin.numbered === identity.pinyinNumbered &&
      Array.isArray(entry.definitionsEn) && Array.isArray(entry.sources) &&
      Array.isArray(entry.sourceRefs) && Array.isArray(entry.variantsOrReferences) &&
      Array.isArray(entry.priorityReasons) && Array.isArray(entry.hskEvidence);
}));

const ordering = inventory.candidates.map((entry) => [
   entry.priority.rank,
   Math.min(...entry.hskEvidence.map((item) => item.hskLevel), 99),
   entry.lexicalIdentity.simplified,
   entry.lexicalIdentity.traditional,
   entry.lexicalIdentity.pinyinNumbered,
   entry.dictionaryEntryId,
]);
const sortedOrdering = [...ordering].sort((left, right) => {
   for (let index = 0; index < left.length; index += 1) {
      const comparison = typeof left[index] === "number"
         ? left[index] - right[index]
         : left[index] < right[index] ? -1 : left[index] > right[index] ? 1 : 0;
      if (comparison) return comparison;
   }
   return 0;
});
assert.deepEqual(ordering, sortedOrdering);

runBuilder(["--check"]);

const testRoot = path.join(root, "tmp", "dictionary-fr-editorial-decision-test");
const decisionsPath = path.join(root, "tmp", "dictionary-fr-editorial-decisions-test.json");
fs.rmSync(testRoot, { recursive: true, force: true });
const selected = inventory.candidates.filter((entry) => entry.state === "candidate").slice(0, 3);
assert.equal(selected.length, 3);
const stateByOffset = ["verified", "rejected", "reviewing"];
const decisions = {
   schemaVersion: 2,
   policyId: "mo-dictionary-fr-editorial-test-v2",
   entries: selected.map((candidate, offset) => ({
      ...candidate.lexicalIdentity,
      state: stateByOffset[offset],
      definitionsFr: offset === 0 ? ["traduction de test v\u00e9rifi\u00e9e"] : [],
      reason: "Fixture de test de persistance des d\u00e9cisions.",
      references: [],
      ...(offset === 0 ? { verifiedAt: "2026-08-11" } : {}),
   })),
};
fs.writeFileSync(decisionsPath, JSON.stringify(decisions, null, 2) + "\n", "utf8");
try {
   runBuilder(["--decisions", decisionsPath, "--output-dir", testRoot]);
   const fixtureInventory = readJson(path.join(testRoot, "inventory.json"));
   const fixtureBatch = readJson(path.join(testRoot, "batches", "batch-0001.json"));
   const fixtureIds = new Set(fixtureInventory.candidates.map((entry) => entry.candidateId));
   assert(!fixtureIds.has(selected[0].candidateId), "a verified entry must not reappear as a candidate");
   assert(!fixtureIds.has(selected[1].candidateId), "a rejected entry must not reappear as a candidate");
   const reviewing = fixtureInventory.candidates.find((entry) => entry.candidateId === selected[2].candidateId);
   assert(reviewing && reviewing.state === "reviewing");
   assert(!fixtureBatch.entries.some((entry) => entry.candidateId === selected[2].candidateId));

   const firstHashes = Object.fromEntries(
      fs.readdirSync(testRoot, { recursive: true, withFileTypes: true })
         .filter((entry) => entry.isFile())
         .map((entry) => {
            const filename = path.join(entry.parentPath, entry.name);
            return [path.relative(testRoot, filename), sha256(fs.readFileSync(filename))];
         }),
   );
   runBuilder(["--decisions", decisionsPath, "--output-dir", testRoot]);
   const secondHashes = Object.fromEntries(
      fs.readdirSync(testRoot, { recursive: true, withFileTypes: true })
         .filter((entry) => entry.isFile())
         .map((entry) => {
            const filename = path.join(entry.parentPath, entry.name);
            return [path.relative(testRoot, filename), sha256(fs.readFileSync(filename))];
         }),
   );
   assert.deepEqual(secondHashes, firstHashes, "rebuilding an unchanged batch must be byte-for-byte idempotent");
} finally {
   fs.rmSync(testRoot, { recursive: true, force: true });
   fs.rmSync(decisionsPath, { force: true });
}

console.log("dictionary French editorial workflow data tests: PASS");
