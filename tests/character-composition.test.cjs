"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
   const builder = await import(
      pathToFileURL(path.resolve(__dirname, "../scripts/build-character-composition.mjs"))
   );

   assert.deepEqual(builder.compactIdsTree(builder.parseIds("⿰亻尔")), {
      o: "⿰",
      c: [{ c: "亻" }, { c: "尔" }],
   });
   assert.deepEqual(builder.compactIdsTree(builder.parseIds("⿳亠口小")), {
      o: "⿳",
      c: [{ c: "亠" }, { c: "口" }, { c: "小" }],
   });
   assert.deepEqual(builder.compactIdsTree(builder.parseIds("⿲王刂王")), {
      o: "⿲",
      c: [{ c: "王" }, { c: "刂" }, { c: "王" }],
   });
   assert.deepEqual(builder.compactIdsTree(builder.parseIds("⿱木⿰木木")), {
      o: "⿱",
      c: [{ c: "木" }, { o: "⿰", c: [{ c: "木" }, { c: "木" }] }],
   });
   assert.equal(builder.parseIds("？"), null);
   assert.equal(builder.parseIds("⿱逢？"), null);
   assert.throws(() => builder.parseIds("⿰木"), /tronqué/u);
   assert.throws(() => builder.parseIds("⿰木木木"), /excédentaire/u);

   const generatedRoot = path.resolve(
      __dirname,
      "../data/generated/character-composition",
   );
   const index = JSON.parse(
      fs.readFileSync(path.join(generatedRoot, "character-index.json"), "utf8"),
   );
   function generated(character) {
      const location = index[character];
      if (!location) return null;
      const chunk = JSON.parse(
         fs.readFileSync(path.join(generatedRoot, "chunks", `${location.chunk}.json`), "utf8"),
      );
      return chunk[character] || null;
   }

   assert.equal(generated("一"), null);
   assert.equal(generated("鶥"), null);
   assert.equal(generated("微").etymology, null);
   assert.equal(generated("你").etymology.type, "ideographic");
   assert.deepEqual(generated("价").etymology, {
      type: "pictophonetic",
      semantic: null,
      phonetic: "介",
      hint: null,
   });
   assert.deepEqual(generated("妈").etymology, {
      type: "pictophonetic",
      semantic: "女",
      phonetic: "马",
      hint: "woman",
   });
   assert.equal(generated("学").components["⺍"].definition, null);
   assert.deepEqual(builder.idsTreeLeaves(builder.parseIds("⿱木⿰木木")), ["木", "木", "木"]);

   const report = JSON.parse(
      fs.readFileSync(path.join(generatedRoot, "build-report.json"), "utf8"),
   );
   const selected = Object.fromEntries(
      report.testCases.map((item) => [item.criterion, item]),
   );
   assert.equal(selected["pictophonetic-complete"].sourceLine, 1602);
   assert.equal(selected.ideographic.sourceLine, 273);
   assert.equal(selected["without-etymology"].sourceLine, 2289);
   assert.equal(selected["pictophonetic-without-hint"].sourceLine, 212);
   assert.equal(selected["nested-ids"].sourceLine, 3405);
   assert.equal(selected["ternary-left-middle-right"].sourceLine, 4571);
   assert.equal(selected["ternary-top-middle-bottom"].sourceLine, 161);
   assert.equal(selected["invalid-full-width-question-mark"].sourceLine, 41);
   assert.equal(selected["component-without-gloss"].sourceLine, 1762);
   assert.equal(selected["dictionary-character-absent-from-source"].sourceLine, null);

   console.log("PASS 26 character composition assertions");
})().catch((error) => {
   console.error(error);
   process.exitCode = 1;
});
