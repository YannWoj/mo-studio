"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

(async () => {
   const builder = await import(
      pathToFileURL(path.resolve(__dirname, "../scripts/build-confusable-pairs.mjs"))
   );

   const generatedRoot = path.resolve(__dirname, "../data/generated/confusable-pairs");
   const manifest = JSON.parse(fs.readFileSync(path.join(generatedRoot, "manifest.json"), "utf8"));
   const report = JSON.parse(fs.readFileSync(path.join(generatedRoot, "build-report.json"), "utf8"));
   const characterIndex = JSON.parse(fs.readFileSync(path.join(generatedRoot, "character-index.json"), "utf8"));

   assert.equal(manifest.format, "mo-studio-confusable-pairs");
   assert.equal(manifest.schemaVersion, 1);
   assert.equal(manifest.builderVersion, builder.CONFUSABLE_PAIRS_BUILDER_VERSION);
   assert.match(manifest.license, /GNU Lesser General Public License/u);
   assert.match(manifest.license, /Arphic Public License/u);
   // Contrairement à learning-units, le dictionnaire ne sert qu'à filtrer/exclure au
   // moment du build ; aucun texte CC-CEDICT/CFDICT n'est copié dans cette sortie,
   // donc pas d'héritage CC BY-SA à revendiquer ici (voir THIRD_PARTY_DATA.md).
   assert.doesNotMatch(manifest.license, /CC BY-SA/u);

   // Faits mesurés (issus d'un vrai build, pas d'estimations) — voir le rapport de
   // chantier pour le détail du calibrage de chaque seuil.
   assert.equal(manifest.counts.comparableCharacterCount, 9433);
   assert.equal(manifest.counts.dictionaryCharacterCount, 14426);
   assert.equal(manifest.counts.structuralPairCount, 120);
   assert.equal(manifest.counts.geometricPairCount, 3048);
   assert.equal(manifest.counts.unionPreExclusionCount, 3158);
   assert.equal(manifest.counts.simplifiedTraditionalPairsInDictionary, 3717);
   assert.equal(manifest.counts.removedAsSimplifiedTraditionalVariantCount, 72);
   assert.equal(manifest.counts.finalPairCount, 3086);
   assert.equal(manifest.counts.activeTierPairCount, 157);
   assert.equal(manifest.counts.passiveOnlyPairCount, 2929);
   assert.equal(manifest.counts.charactersWithAtLeastOnePartner, 3487);
   assert.equal(manifest.counts.activeTierPairCount + manifest.counts.passiveOnlyPairCount, manifest.counts.finalPairCount);

   assert.equal(manifest.criteria.geometric.retentionThreshold, 0.47);
   assert.equal(manifest.criteria.geometric.activeTierThreshold, 0.65);
   assert.equal(manifest.criteria.geometric.dilationTestedAndRejected, true);
   assert.equal(manifest.criteria.geometric.mutualTopKTestedAndRejected, true);

   // Les quatre paires explicitement exigées par la vérification du chantier.
   const required = new Map(report.requiredVerificationPairs.map((pair) => [`${pair.a}/${pair.b}`, pair]));
   assert.equal(required.size, 4);
   for (const key of ["未/末", "日/曰", "己/已", "土/士"]) {
      assert.ok(required.has(key) && required.get(key).found, `${key} doit être présente dans l'index`);
   }
   assert.deepEqual(required.get("未/末"), { a: "未", b: "末", found: true, structural: true, geometricScore: 0.6702127659574468, activeTier: true });
   assert.deepEqual(required.get("日/曰"), { a: "日", b: "曰", found: true, structural: true, geometricScore: null, activeTier: true });
   assert.deepEqual(required.get("己/已"), { a: "己", b: "已", found: true, structural: false, geometricScore: 0.4935064935064935, activeTier: false });
   assert.deepEqual(required.get("土/士"), { a: "土", b: "士", found: true, structural: false, geometricScore: 0.47692307692307695, activeTier: false });

   // Lacunes documentées, assumées : aucune n'est retenue, et le rapport doit
   // continuer à en rendre compte plutôt que de les passer sous silence. 己/巳 a
   // rejoint cette liste après le durcissement du critère structurel (voir plus
   // bas) : ils ne partageaient qu'un seul composant nommé ({乚}), le même genre
   // de signal faible que celui qui polluait le niveau révision avant correction.
   const gaps = new Map(report.knownGaps.map((gap) => [`${gap.a}/${gap.b}`, gap]));
   assert.equal(gaps.get("已/巳").inFinalIndex, false);
   assert.ok(Math.abs(gaps.get("已/巳").geometricScore - 0.294) < 0.001);
   assert.equal(gaps.get("人/入").inFinalIndex, false);
   assert.ok(Math.abs(gaps.get("人/入").geometricScore - 0.188) < 0.001);
   assert.equal(gaps.get("己/巳").inFinalIndex, false);
   assert.ok(Math.abs(gaps.get("己/巳").geometricScore - 0.270) < 0.001);

   // Le filtre simplifié/traditionnel doit avoir retiré des variantes connues et
   // n'avoir jamais pu les laisser rentrer par la bande.
   function findPartner(character, partner) {
      const info = characterIndex[character];
      if (!info) return null;
      const chunk = JSON.parse(fs.readFileSync(path.join(generatedRoot, "chunks", `${info.chunk}.json`), "utf8"));
      return (chunk[character] || []).find((entry) => entry.character === partner) || null;
   }
   for (const [a, b] of [["內", "内"], ["戶", "户"], ["丟", "丢"]]) {
      assert.equal(findPartner(a, b), null, `${a}/${b} est une variante simplifié/traditionnel, ne doit pas être dans l'index`);
      assert.equal(findPartner(b, a), null);
   }

   // Symétrie : si A référence B, B référence A avec le même statut et le même
   // score, chacun avec son propre indice de trait qui diffère (pas le même indice
   // recopié des deux côtés).
   const weiToMo = findPartner("未", "末");
   const moToWei = findPartner("末", "未");
   assert.ok(weiToMo && moToWei);
   assert.equal(weiToMo.structural, true);
   assert.equal(weiToMo.activeTier, true);
   assert.equal(weiToMo.geometricScore, moToWei.geometricScore);
   assert.equal(weiToMo.diffStrokeIndex, 2);
   assert.equal(moToWei.diffStrokeIndex, 2);

   const tuToShi = findPartner("土", "士");
   const shiToTu = findPartner("士", "土");
   assert.ok(tuToShi && shiToTu);
   assert.equal(tuToShi.activeTier, false); // sous le seuil du niveau révision (0.477 < 0.65)
   assert.equal(tuToShi.diffStrokeIndex, 1);
   assert.equal(shiToTu.diffStrokeIndex, 0); // indice propre à 士, distinct de celui de 土

   // Un caractère jamais présent dans les données de composition (己 a une fiche,
   // 已 n'en a aucune) ne peut jamais obtenir de partenaire structurel — seul le
   // critère géométrique peut le faire figurer dans l'index.
   const jiToYi = findPartner("己", "已");
   assert.equal(jiToYi.structural, false);

   // Reconstruction déterministe : même buildId, contenu identique octet pour
   // octet (couverture complète assurée par ailleurs par
   // scripts/validate-confusable-pairs.mjs ; ici un spot check rapide).
   const rebuiltDirectory = path.join(os.tmpdir(), "mo-confusable-pairs-spotcheck");
   const rebuilt = await builder.buildConfusablePairsIndex({ outputDirectory: rebuiltDirectory });
   assert.equal(rebuilt.manifest.buildId, manifest.buildId);
   fs.rmSync(rebuiltDirectory, { recursive: true, force: true });

   console.log(
      `PASS confusable-pairs.test.cjs — ${manifest.counts.finalPairCount} paires ` +
         `(${manifest.counts.activeTierPairCount} niveau révision, ${manifest.counts.passiveOnlyPairCount} niveau fiche), ` +
         `4/4 paires de vérification, lacunes 已/巳, 己/巳 et 人/入 confirmées absentes`,
   );
})().catch((error) => {
   console.error(error);
   process.exit(1);
});
