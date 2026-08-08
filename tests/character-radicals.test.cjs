"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
   const builder = await import(
      pathToFileURL(path.resolve(__dirname, "../scripts/build-character-radicals.mjs"))
   );

   const generatedRoot = path.resolve(__dirname, "../data/generated/character-radicals");
   const manifest = JSON.parse(fs.readFileSync(path.join(generatedRoot, "manifest.json"), "utf8"));
   const report = JSON.parse(fs.readFileSync(path.join(generatedRoot, "build-report.json"), "utf8"));

   assert.equal(manifest.format, "mo-studio-character-radicals");
   assert.equal(manifest.schemaVersion, 1);
   assert.equal(manifest.builderVersion, builder.RADICALS_BUILDER_VERSION);

   // Measured facts (derived directly from the real generated data, not estimates).
   assert.equal(manifest.counts.radicalsInSource, 289);
   assert.equal(manifest.counts.radicalsWithDictionaryMembers, 288);
   assert.equal(manifest.counts.charactersCovered, 9409);
   assert.equal(manifest.counts.dictionaryCharactersTotal, 14426);
   assert.equal(manifest.counts.dictionaryCharactersWithoutRadical, 5017);
   assert.equal(manifest.radicals.length, 288);

   // The one radical with zero dictionary-linked members is excluded from the picker.
   assert.deepEqual(report.coverage.excludedRadicals, ["尣"]);
   assert.equal(manifest.radicals.some((row) => row.radical === "尣"), false);

   // A large, a self-radical, and several genuine 1-member groups exist in the real data.
   const water = manifest.radicals.find((row) => row.radical === "氵");
   assert.ok(water && water.memberCount >= 400, "氵 should have a large member count");
   assert.equal(water.strokeCount, 3);
   assert.equal(typeof water.sens, "string");

   const oneMemberRadicals = manifest.radicals.filter((row) => row.memberCount === 1);
   assert.ok(oneMemberRadicals.length >= 10, "expected several genuine 1-member radicals");
   assert.ok(oneMemberRadicals.some((row) => row.radical === "兀"));

   // Every radical in today's data has a known stroke count (hanzi-writer covers all of them);
   // the "unknown stroke count" code path is exercised only via a synthesized case in the
   // browser test, since no real example exists — do not assert a real one here either.
   assert.equal(manifest.radicals.every((row) => row.strokeCount != null), true);

   // Each chunk file matches its manifest row and is sorted ascending by stroke count.
   for (const row of [water, oneMemberRadicals[0]]) {
      const chunk = JSON.parse(
         fs.readFileSync(path.join(generatedRoot, row.path.replaceAll("/", path.sep)), "utf8"),
      );
      assert.equal(chunk.radical, row.radical);
      assert.equal(chunk.characters.length, row.memberCount);
      for (let index = 1; index < chunk.characters.length; index++) {
         const previous = chunk.characters[index - 1].strokeCount ?? Infinity;
         const current = chunk.characters[index].strokeCount ?? Infinity;
         assert.ok(current >= previous, `${row.radical} members not sorted ascending by stroke count`);
      }
   }

   // Deterministic rebuild produces byte-identical chunk content for a spot-checked radical.
   const rebuilt = await builder.buildCharacterRadicals({
      outputDirectory: path.join(require("node:os").tmpdir(), "mo-radicals-spotcheck"),
   });
   assert.equal(rebuilt.manifest.buildId, manifest.buildId);
   fs.rmSync(rebuilt.outputDirectory, { recursive: true, force: true });

   console.log(
      `PASS character-radicals.test.cjs — ${manifest.counts.radicalsWithDictionaryMembers} clés, ` +
         `${manifest.counts.charactersCovered} caractères couverts, ` +
         `${oneMemberRadicals.length} clés à 1 membre`,
   );
})().catch((error) => {
   console.error(error);
   process.exit(1);
});
