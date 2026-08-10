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
   assert.deepEqual(builder.compactIdsTree(builder.parseIds("⿸？月")), {
      o: "⿸",
      c: [{ u: true }, { c: "月" }],
   });
   assert.deepEqual(builder.compactIdsTree(builder.parseIds("⿱⿰？土儿")), {
      o: "⿱",
      c: [{ o: "⿰", c: [{ u: true }, { c: "土" }] }, { c: "儿" }],
   });
   assert.equal(builder.parseIds("？"), null);
   const allUnknown = builder.parseIds("⿰？？");
   assert.deepEqual(builder.compactIdsTree(allUnknown), {
      o: "⿰",
      c: [{ u: true }, { u: true }],
   });
   assert.deepEqual(builder.idsTreeLeaves(allUnknown), []);
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

   assert.equal(generated("丨"), null);
   assert.equal(generated("鶥"), null);
   assert.equal(generated("一").tree, null);
   assert.deepEqual(generated("人").etymology, {
      type: "pictographic",
      semantic: null,
      phonetic: null,
      hint: "The legs of a human being",
      hintFr: "Les jambes d’un être humain",
   });
   assert.equal(generated("人").tree, null);
   assert.deepEqual(generated("面").etymology, {
      type: "pictographic",
      semantic: null,
      phonetic: null,
      hint: "A person's face",
   });
   assert.equal(generated("面").tree, null);
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
   assert.deepEqual(generated("有").tree, {
      o: "⿸",
      c: [{ u: true }, { c: "月" }],
   });
   assert.deepEqual(generated("有").etymology, {
      type: "pictophonetic",
      semantic: null,
      phonetic: "月",
      hint: null,
   });
   assert.deepEqual(generated("雨").tree, {
      o: "⿻",
      c: [{ c: "帀" }, { u: true }],
   });
   assert.equal(generated("雨").etymology.hint, "Rain drops falling from a cloud 帀");
   assert.equal(generated("雨").etymology.hintFr, "Des gouttes de pluie tombant d’un nuage 帀");
   assert.equal(generated("水").etymology.hint, "A river running between two banks; compare 川");
   assert.equal(generated("水").etymology.hintFr, "Une rivière coulant entre deux rives ; comparer avec 川");
   assert.equal(generated("女").tree, null);
   assert.equal(generated("女").etymology.hintFr, "Une femme tournée de côté");
   assert.equal(generated("妈").etymology.hintFr, undefined);
   assert.deepEqual(generated("北").tree, {
      o: "⿰",
      c: [{ u: true }, { c: "匕" }],
   });
   assert.deepEqual(generated("先").tree, {
      o: "⿱",
      c: [{ o: "⿰", c: [{ u: true }, { c: "土" }] }, { c: "儿" }],
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
   assert.equal(selected["partial-ids-simple"].sourceLine, 3185);
   assert.equal(selected["partial-ids-nested"].sourceLine, 482);
   assert.equal(selected["unknown-only-decomposition"].sourceLine, 169);
   assert.equal(selected["all-components-unidentified"].sourceLine, 8723);
   assert.equal(selected["component-without-gloss"].sourceLine, 1762);
   assert.equal(selected["dictionary-character-absent-from-source"].sourceLine, null);

   assert.equal(report.coverage.sourcePartialDecompositionCount, 383);
   assert.equal(report.coverage.sourcePartiallyKnownCompositionCount, 365);
   assert.equal(report.coverage.sourceAllComponentsUnidentifiedCount, 18);
   assert.equal(report.coverage.dictionaryWithPartialDecompositionCount, 365);
   assert.equal(report.coverage.dictionaryWithPartiallyKnownCompositionCount, 348);
   assert.equal(report.coverage.dictionaryWithAllComponentsUnidentifiedCount, 17);
   assert.equal(report.coverage.sourceCharacterCompositionBlockCount, 9543);
   assert.equal(report.coverage.sourceUsableCompositionCount, 9490);
   assert.equal(report.coverage.sourceOriginHintCount, 8948);
   assert.equal(report.coverage.sourceGainingOriginHintBlockCount, 53);
   assert.equal(report.coverage.dictionaryWithCharacterCompositionBlockCount, 9409);
   assert.equal(report.coverage.dictionaryWithUsableCompositionCount, 9361);
   assert.equal(report.coverage.dictionaryWithOriginHintCount, 8865);
   assert.equal(report.coverage.dictionaryGainingOriginHintBlockCount, 48);
   assert.equal(report.coverage.dictionaryWithFrenchOriginHintCount, 8);
   assert.equal(report.hintTranslations.entryCount, 8);
   assert.equal(report.hintTranslations.upstreamLicenseApplies, false);

   const frenchHints = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../data/source/character-hints-fr.json"), "utf8"),
   );
   assert.equal(Object.keys(frenchHints).length, 8);
   assert.equal(frenchHints["人"], "Les jambes d’un être humain");

   // Noms français des composants : même contrat que les origines traduites —
   // contenu original écrit à la main, prioritaire sur l'anglais de la source.
   const frenchComponents = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../data/source/character-components-fr.json"), "utf8"),
   );
   assert.equal(report.componentLabelsFr.entryCount, Object.keys(frenchComponents).length);
   assert.equal(report.componentLabelsFr.upstreamLicenseApplies, false);
   assert.equal(report.componentLabelsFr.file, "data/source/character-components-fr.json");
   for (const [component, label] of Object.entries(frenchComponents)) {
      assert.equal(Array.from(component).length, 1, `clé non atomique : ${component}`);
      assert.ok(/^\p{Script=Han}$/u.test(component), `clé hors écriture Han : ${component}`);
      assert.ok(label.trim().length > 0, `libellé vide pour ${component}`);
      assert.equal(label, label.trim().replace(/\s+/gu, " "), `espaces à normaliser pour ${component}`);
   }

   // Les deux radicaux visuellement jumeaux portent des noms distincts et explicites,
   // et restent deux points de code différents — jamais fusionnés.
   assert.notEqual("⺼".codePointAt(0), "月".codePointAt(0));
   assert.notEqual("衤".codePointAt(0), "礻".codePointAt(0));
   assert.match(frenchComponents["⺼"], /chair/);
   assert.match(frenchComponents["月"], /lune/);
   assert.match(frenchComponents["衤"], /衣/);
   assert.match(frenchComponents["礻"], /示/);

   // Les formes liées les plus fréquentes portent un nom français dans les chunks
   // générés, quelle qu'en soit la source (fichier écrit à la main ou dictionnaire).
   for (const [host, component] of [
      ["神", "礻"], ["你", "亻"], ["河", "氵"], ["花", "艹"], ["说", "讠"],
      ["到", "刂"], ["打", "扌"], ["快", "忄"], ["爱", "爫"], ["袖", "衤"],
      ["这", "辶"], ["钱", "钅"], ["脸", "⺼"],
   ]) {
      const record = generated(host);
      assert.ok(record, `fiche de composition absente : ${host}`);
      const entry = record.components[component];
      assert.ok(entry, `${component} n'est pas un composant de ${host}`);
      assert.ok(entry.definitionFr, `composant fréquent sans nom français : ${component} (dans ${host})`);
   }
   // ⺼ et 月 se ressemblent mais ne disent pas la même chose à l'écran.
   assert.match(generated("脸").components["⺼"].definitionFr, /chair/);
   assert.match(generated("朋").components["月"].definitionFr, /lune/);

   console.log("PASS 96 character composition assertions");
})().catch((error) => {
   console.error(error);
   process.exitCode = 1;
});
