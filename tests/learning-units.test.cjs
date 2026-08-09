"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

(async () => {
   const builder = await import(
      pathToFileURL(path.resolve(__dirname, "../scripts/build-learning-units.mjs"))
   );

   const generatedRoot = path.resolve(__dirname, "../data/generated/learning-units");
   const manifest = JSON.parse(fs.readFileSync(path.join(generatedRoot, "manifest.json"), "utf8"));
   const report = JSON.parse(fs.readFileSync(path.join(generatedRoot, "build-report.json"), "utf8"));
   const unitsIndex = JSON.parse(fs.readFileSync(path.join(generatedRoot, "units-index.json"), "utf8"));

   assert.equal(manifest.format, "mo-studio-learning-units");
   assert.equal(manifest.schemaVersion, 1);
   assert.equal(manifest.builderVersion, builder.LEARNING_UNITS_BUILDER_VERSION);
   assert.match(manifest.license, /GNU Lesser General Public License/u);
   assert.match(manifest.license, /CC BY-SA/u);

   // Measured facts (derived directly from the real generated data, not estimates).
   assert.equal(manifest.counts.dictionaryCharacterCount, 14426);
   assert.equal(manifest.counts.distinctPhoneticComponentsWithAnyDictionaryMember, 1549);
   assert.equal(manifest.counts.retainedPhoneticFamilyCount, 1026);
   assert.equal(manifest.counts.phoneticFamiliesWithAtLeast4Members, 646);
   assert.equal(manifest.counts.retainedSemanticGroupCount, 233);
   assert.equal(manifest.counts.unitCount, unitsIndex.length);
   assert.equal(manifest.counts.phoneticUnitCount + manifest.counts.semanticUnitCount, manifest.counts.unitCount);
   assert.equal(manifest.counts.cyclesDetectedCount, 0);
   assert.equal(manifest.counts.selfReferencesDetectedCount, 0);
   assert.equal(manifest.counts.dictionaryReachableCount, 9426);
   assert.equal(manifest.counts.dictionaryOrphanedCount, 5000);
   assert.equal(
      manifest.counts.dictionaryReachableCount + manifest.counts.dictionaryOrphanedCount,
      manifest.counts.dictionaryCharacterCount,
   );
   assert.equal(manifest.counts.totalCoveredCharacterCount, 9358);
   assert.equal(
      manifest.counts.totalCoveredCharacterCount + manifest.counts.uncoveredCharacterCount,
      manifest.counts.dictionaryCharacterCount,
   );

   // No personal-library export is checked into the repo (private data), so this
   // signal must honestly report zero rather than guessing — see build-report.md.
   assert.equal(manifest.counts.personalLibraryFound, false);
   assert.equal(manifest.counts.personalLibraryCardCount, 0);
   assert.equal(manifest.counts.unitsCoveringAtLeastOnePersonalWord, 0);
   assert.equal(manifest.counts.personalCoverageApplicable, false);

   // Every unit stays within the requested 2-8 member window (families of 2-3
   // are kept whole; anything above 8 is split by buildUnitsFromGroup).
   for (const unit of unitsIndex) {
      assert.ok(unit.memberCharacters.length >= 2 && unit.memberCharacters.length <= 8, `${unit.id} out of range`);
      assert.ok(unit.type === "phonetic" || unit.type === "semantic", `${unit.id} has unknown type`);
      assert.ok(Number.isFinite(unit.utilityScore));
   }

   // The running example from the brief: the 青 phonetic family, split into
   // ordered parts, most-useful characters first.
   const qing1 = unitsIndex.find((unit) => unit.id === "phon-青-1");
   assert.ok(qing1, "expected phon-青-1 to exist");
   assert.equal(qing1.partCount, 3);
   assert.deepEqual(qing1.prerequisites, ["月", "龶"]);
   assert.deepEqual(qing1.memberCharacters, ["请", "情", "清", "精", "請", "氰", "猜"]);
   const qingFamily = report.exampleUnit.id === "phon-青-1" ? report.exampleUnit : null;
   if (qingFamily) {
      const qing = qingFamily.members.find((member) => member.character === "请");
      assert.equal(qing.pinyin, "qǐng");
      assert.equal(qing.gloss, "prier");
   }

   // A large semantic (radical) fallback group exists and is split into many parts.
   const personRadicalUnits = unitsIndex.filter((unit) => unit.type === "semantic" && unit.component === "亻");
   assert.ok(personRadicalUnits.length >= 10, "expected 亻 to need many parts after phonetic coverage is removed");

   // The phonetic-families.json raw index (part 1) matches the units built from it.
   const phoneticFamilies = JSON.parse(fs.readFileSync(path.join(generatedRoot, "phonetic-families.json"), "utf8"));
   assert.equal(phoneticFamilies.length, manifest.counts.retainedPhoneticFamilyCount);
   const qingRawFamily = phoneticFamilies.find((family) => family.component === "青");
   assert.equal(qingRawFamily.members.length, 19);
   assert.equal(qingRawFamily.componentPinyin, "qīng");

   // graph.json exposes both directions and stays free of infinite structures.
   const graph = JSON.parse(fs.readFileSync(path.join(generatedRoot, "graph.json"), "utf8"));
   assert.deepEqual(graph.meta.cyclesDetected, []);
   assert.deepEqual(graph.meta.selfReferencesDetected, []);
   assert.deepEqual(graph.prerequisites["青"], ["月", "龶"]);
   assert.ok(Array.isArray(graph.unlocks["青"]) && graph.unlocks["青"].length >= 19);

   // utility-scores.json covers the whole dictionary, not just characters used in a unit.
   const utilityScores = JSON.parse(fs.readFileSync(path.join(generatedRoot, "utility-scores.json"), "utf8"));
   assert.equal(Object.keys(utilityScores).length, manifest.counts.dictionaryCharacterCount);
   assert.equal(utilityScores["请"].inHsk1, true);
   assert.equal(utilityScores["请"].tier, 2);

   // Deterministic rebuild produces the same buildId (full byte-for-byte diff is
   // covered by validate-learning-units.mjs; this is a fast spot check).
   const rebuiltDirectory = path.join(os.tmpdir(), "mo-learning-units-spotcheck");
   const rebuilt = await builder.buildLearningUnitsIndex({ outputDirectory: rebuiltDirectory });
   assert.equal(rebuilt.manifest.buildId, manifest.buildId);
   fs.rmSync(rebuiltDirectory, { recursive: true, force: true });

   console.log(
      `PASS learning-units.test.cjs — ${manifest.counts.unitCount} unités, ` +
         `${manifest.counts.retainedPhoneticFamilyCount} familles phonétiques, ` +
         `${manifest.counts.dictionaryReachableCount} caractères atteignables, ` +
         `${manifest.counts.cyclesDetectedCount} cycles`,
   );
})().catch((error) => {
   console.error(error);
   process.exit(1);
});
