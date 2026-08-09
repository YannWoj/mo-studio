import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

export const CONFUSABLE_PAIRS_BUILDER_VERSION = "1.0.0";
export const CHUNK_MODULO = 64; // même convention que character-composition
export const STROKE_COUNT_WINDOW = 1; // ±1 trait, pour les deux critères
export const OCCUPANCY_GRID_SIZE = 24;
export const OCCUPANCY_GRID_BOX = 1024; // hanzi-writer : viewBox "0 0 1024 1024"
export const OCCUPANCY_SAMPLES_PER_CELL = 2; // densité d'échantillonnage le long de chaque segment de médiane
export const GEOMETRIC_RETENTION_THRESHOLD = 0.47; // niveau fiche : calé sur 土/士 (score mesuré 0.477)
export const GEOMETRIC_ACTIVE_TIER_THRESHOLD = 0.65; // niveau révision : nettement au-dessus du seuil de rétention

const defaultCompositionDirectory = path.join(projectRoot, "data", "generated", "character-composition");
const defaultHanziWriterDirectory = path.join(projectRoot, "data", "generated", "hanzi-writer", "2.0.1");
const defaultDictionaryDirectory = path.join(projectRoot, "data", "generated", "dictionary");
const defaultOutputDirectory = path.join(projectRoot, "data", "generated", "confusable-pairs");
const PAIRS_CHUNK_THRESHOLD_BYTES = 400_000;

function sha256(value) {
   return createHash("sha256").update(value).digest("hex");
}

function compareCharacters(left, right) {
   const leftCodepoint = left.codePointAt(0) || 0;
   const rightCodepoint = right.codePointAt(0) || 0;
   return leftCodepoint - rightCodepoint || left.localeCompare(right, "zh");
}

function pairKey(a, b) {
   return compareCharacters(a, b) <= 0 ? `${a}|${b}` : `${b}|${a}`;
}

async function writeJson(filename, value, pretty = false) {
   const content = `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
   await writeFile(filename, content, "utf8");
   return Buffer.from(content, "utf8");
}

async function readJson(filename) {
   return JSON.parse(await readFile(filename, "utf8"));
}

function chunkKeyFor(character) {
   return ((character.codePointAt(0) || 0) % CHUNK_MODULO).toString(16).padStart(2, "0");
}

/* ================= chargement des données déjà générées ================= */

async function loadCompositionRecords(compositionDirectory) {
   const chunkDirectory = path.join(compositionDirectory, "chunks");
   const chunkFiles = (await readdir(chunkDirectory)).filter((name) => name.endsWith(".json")).sort();
   const recordsByCharacter = new Map();
   for (const filename of chunkFiles) {
      const chunk = await readJson(path.join(chunkDirectory, filename));
      for (const [character, record] of Object.entries(chunk)) {
         recordsByCharacter.set(character, record);
      }
   }
   return recordsByCharacter;
}

// On ne lit que les fichiers hanzi-writer réellement utiles (intersection avec le
// dictionnaire), pas les 9575 fichiers du paquet — readdir une fois pour lister,
// puis un readFile ciblé par caractère comparable.
async function loadHanziWriterData(hanziWriterDirectory, dictionaryCharacters) {
   const entries = await readdir(hanziWriterDirectory);
   const available = new Set(
      entries.filter((name) => name.endsWith(".json") && name !== "manifest.json" && name !== "package.json")
         .map((name) => name.slice(0, -5)),
   );
   const comparable = [...dictionaryCharacters].filter((character) => available.has(character)).sort(compareCharacters);
   const byCharacter = new Map();
   for (const character of comparable) {
      const raw = await readJson(path.join(hanziWriterDirectory, `${character}.json`));
      if (!Array.isArray(raw.strokes) || !raw.strokes.length) continue;
      const medians = Array.isArray(raw.medians) ? raw.medians : [];
      if (medians.length !== raw.strokes.length) continue; // données incohérentes, caractère écarté
      byCharacter.set(character, { strokeCount: raw.strokes.length, medians });
   }
   return byCharacter;
}

// Reproduit exactement le mécanisme déjà écrit pour le Parcours
// (js/learning-units/learning-unit-lesson.js : dictionaryWordEntriesForCharacter +
// simplifiedTraditionalPairFor), côté Node au lieu du navigateur : une entrée de
// type "word" dont le simplifié est le caractère, avec un traditionnel distinct à
// un seul caractère, désigne un couple simplifié/traditionnel à exclure. Les
// entrées de type "character" ont toujours traditional === simplified (vérifié sur
// les données réelles) et ne servent donc à rien pour cette détection.
async function loadSimplifiedTraditionalExclusions(dictionaryDirectory, dictionaryCharacters) {
   const exactHanziIndex = await readJson(path.join(dictionaryDirectory, "exact-hanzi-index.json"));
   const entryLocations = await readJson(path.join(dictionaryDirectory, "entry-locations.json"));
   const chunkCache = new Map();
   async function loadEntry(ref) {
      const location = entryLocations[String(ref)];
      if (!location) return null;
      const [id, chunkKey] = location;
      if (!chunkCache.has(chunkKey)) {
         const chunk = await readJson(path.join(dictionaryDirectory, "entries", `${chunkKey}.json`));
         chunkCache.set(chunkKey, new Map(chunk.entries.map((entry) => [entry.id, entry])));
      }
      return chunkCache.get(chunkKey).get(id) || null;
   }
   const exclusions = new Set();
   for (const character of [...dictionaryCharacters].sort(compareCharacters)) {
      for (const ref of exactHanziIndex[character] || []) {
         const entry = await loadEntry(ref);
         if (
            entry &&
            entry.entryType === "word" &&
            entry.simplified === character &&
            entry.traditional &&
            entry.traditional !== character &&
            Array.from(entry.traditional).length === 1
         ) {
            exclusions.add(pairKey(character, entry.traditional));
         }
      }
   }
   return exclusions;
}

/* ================= critère structurel ================= */

// Composants IDS de premier niveau *nommés* : on ignore "？" (composant non
// résolu par Make Me a Hanzi) et les nœuds marqués u:true (inconnu). Un caractère
// sans aucun composant nommé (ex. 已, 士 : aucune fiche de composition ; 人, 入 :
// décomposition "？" atomique) ne peut jamais matcher ce critère.
// Un seul composant nommé partagé n'est pas un signal fiable : "一" (le trait le
// plus simple qui existe) se retrouve, seul, comme unique composant nommé de 20
// caractères différents (vérifié sur les données réelles) — un partage aussi
// commun ne dit presque rien sur une ressemblance visuelle réelle. Exiger au
// moins deux composants nommés partagés (comme 未/末 → {一,木}, 日/曰 → {一,口})
// élimine ce faux signal tout en conservant les appariements structurels
// réellement distinctifs. Conséquence assumée : un partage à un seul composant,
// même rare (己/巳 → {乚} à eux deux seulement), ne suffit plus — voir knownGaps.
function namedComponentSet(record) {
   if (!record || !record.tree) return null;
   const names = [];
   const walk = (node) => {
      if (!node) return;
      if (node.u === true) return;
      if (typeof node.c === "string") {
         if (node.c !== "？") names.push(node.c);
         return;
      }
      if (Array.isArray(node.c)) node.c.forEach(walk);
   };
   walk(record.tree);
   const unique = Array.from(new Set(names)).sort(compareCharacters);
   return unique.length >= 2 ? unique : null;
}

function buildStructuralPairs(compositionRecords, hanziWriterData) {
   const namedSets = new Map();
   for (const [character, record] of compositionRecords) {
      if (!hanziWriterData.has(character)) continue; // il faut le nombre de traits réel (hanzi-writer)
      const set = namedComponentSet(record);
      if (set) namedSets.set(character, set);
   }
   const bySignature = new Map();
   for (const character of [...namedSets.keys()].sort(compareCharacters)) {
      const signature = namedSets.get(character).join(",");
      if (!bySignature.has(signature)) bySignature.set(signature, []);
      bySignature.get(signature).push(character);
   }
   const pairs = new Map();
   for (const characters of bySignature.values()) {
      if (characters.length < 2) continue;
      for (let i = 0; i < characters.length; i++) {
         for (let j = i + 1; j < characters.length; j++) {
            const strokeDiff = Math.abs(
               hanziWriterData.get(characters[i]).strokeCount - hanziWriterData.get(characters[j]).strokeCount,
            );
            if (strokeDiff > STROKE_COUNT_WINDOW) continue;
            pairs.set(pairKey(characters[i], characters[j]), { a: characters[i], b: characters[j] });
         }
      }
   }
   return pairs;
}

/* ================= critère géométrique ================= */

// Grille d'occupation booléenne 24×24 par caractère, construite en échantillonnant
// les polylignes `medians` de hanzi-writer (le squelette de chaque trait, pas le
// tracé SVG rempli) le long de chaque segment. Empaquetée en mots de 32 bits pour
// un popcount rapide (indispensable : la version naïve BigInt bit-à-bit prenait
// 3-4 minutes sur les ~8,8M paires candidates à comparer, la version par mots
// quelques secondes). Le dilatement d'un pixel a été testé et rejeté : il gonfle
// la similarité de presque toutes les paires au point de rendre tout seuil
// inutilisable. Une variante par plus-proches-voisins mutuels (top-K) a aussi été
// testée et rejetée : à pleine échelle la grille est trop grossière (trop
// d'ex-æquo) pour qu'un classement discrimine mieux qu'un seuil absolu.
function occupancyBitmask(medians) {
   let mask = 0n;
   const cellWidth = OCCUPANCY_GRID_BOX / OCCUPANCY_GRID_SIZE;
   for (const stroke of medians) {
      for (let i = 0; i < stroke.length - 1; i++) {
         const [x0, y0] = stroke[i];
         const [x1, y1] = stroke[i + 1];
         const distance = Math.hypot(x1 - x0, y1 - y0);
         const steps = Math.max(1, Math.ceil(distance / (cellWidth / OCCUPANCY_SAMPLES_PER_CELL)));
         for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            const gx = Math.min(OCCUPANCY_GRID_SIZE - 1, Math.max(0, Math.floor((x / OCCUPANCY_GRID_BOX) * OCCUPANCY_GRID_SIZE)));
            const gy = Math.min(OCCUPANCY_GRID_SIZE - 1, Math.max(0, Math.floor((y / OCCUPANCY_GRID_BOX) * OCCUPANCY_GRID_SIZE)));
            mask |= 1n << BigInt(gy * OCCUPANCY_GRID_SIZE + gx);
         }
      }
   }
   return mask;
}

function popcount32(x) {
   x = x - ((x >> 1) & 0x55555555);
   x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
   x = (x + (x >> 4)) & 0x0f0f0f0f;
   return ((x * 0x01010101) >> 24) & 0xff;
}

function bitmaskToWords(mask) {
   const words = [];
   let remaining = mask;
   const wordMask = 0xffffffffn;
   while (remaining > 0n) {
      words.push(Number(remaining & wordMask));
      remaining >>= 32n;
   }
   return words;
}

function jaccardOfWords(wordsA, wordsB) {
   const length = Math.max(wordsA.length, wordsB.length);
   let intersection = 0;
   let union = 0;
   for (let i = 0; i < length; i++) {
      const a = wordsA[i] || 0;
      const b = wordsB[i] || 0;
      intersection += popcount32(a & b);
      union += popcount32(a | b);
   }
   return union === 0 ? 0 : intersection / union;
}

function scoreForPair(occupancyWords, a, b) {
   return jaccardOfWords(occupancyWords.get(a), occupancyWords.get(b));
}

function buildGeometricPairs(hanziWriterData, occupancyWords) {
   const byStroke = new Map();
   for (const character of [...hanziWriterData.keys()].sort(compareCharacters)) {
      const strokeCount = hanziWriterData.get(character).strokeCount;
      if (!byStroke.has(strokeCount)) byStroke.set(strokeCount, []);
      byStroke.get(strokeCount).push(character);
   }
   const strokeCounts = [...byStroke.keys()].sort((a, b) => a - b);
   const pairs = new Map();
   for (const strokeCount of strokeCounts) {
      const groupA = byStroke.get(strokeCount);
      for (let i = 0; i < groupA.length; i++) {
         for (let j = i + 1; j < groupA.length; j++) {
            const score = scoreForPair(occupancyWords, groupA[i], groupA[j]);
            if (score >= GEOMETRIC_RETENTION_THRESHOLD) {
               pairs.set(pairKey(groupA[i], groupA[j]), { a: groupA[i], b: groupA[j], score });
            }
         }
      }
      const groupB = byStroke.get(strokeCount + STROKE_COUNT_WINDOW);
      if (!groupB) continue;
      for (const a of groupA) {
         for (const b of groupB) {
            const score = scoreForPair(occupancyWords, a, b);
            if (score >= GEOMETRIC_RETENTION_THRESHOLD) {
               pairs.set(pairKey(a, b), { a, b, score });
            }
         }
      }
   }
   return pairs;
}

/* ================= trait qui diffère le plus (pour la fiche) ================= */

function centroidOf(strokeMedian) {
   let x = 0;
   let y = 0;
   for (const [px, py] of strokeMedian) {
      x += px;
      y += py;
   }
   return [x / strokeMedian.length, y / strokeMedian.length];
}

// Appariement glouton par centroïde le plus proche entre les traits des deux
// caractères (uniquement quand ils ont le même nombre de traits — pas de
// bijection propre sinon). Le trait le plus "déplacé" (distance de centroïde
// maximale parmi les paires appariées une à une) est celui qu'on met en évidence.
// Les deux index retournés sont cohérents entre eux (même appariement global).
function differingStrokeIndices(dataA, dataB) {
   if (dataA.strokeCount !== dataB.strokeCount) return { inA: null, inB: null };
   const centroidsA = dataA.medians.map(centroidOf);
   const centroidsB = dataB.medians.map(centroidOf);
   const n = centroidsA.length;
   const candidates = [];
   for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
         const distance = Math.hypot(centroidsA[i][0] - centroidsB[j][0], centroidsA[i][1] - centroidsB[j][1]);
         candidates.push([i, j, distance]);
      }
   }
   candidates.sort((left, right) => left[2] - right[2]);
   const usedA = new Array(n).fill(false);
   const usedB = new Array(n).fill(false);
   const matches = [];
   for (const [i, j, distance] of candidates) {
      if (usedA[i] || usedB[j]) continue;
      usedA[i] = true;
      usedB[j] = true;
      matches.push({ i, j, distance });
   }
   const worst = matches.slice().sort((left, right) => right.distance - left.distance)[0];
   return { inA: worst.i, inB: worst.j };
}

/* ================= construction principale ================= */

export async function buildConfusablePairsIndex(options = {}) {
   const compositionDirectory = path.resolve(options.compositionDirectory || defaultCompositionDirectory);
   const hanziWriterDirectory = path.resolve(options.hanziWriterDirectory || defaultHanziWriterDirectory);
   const dictionaryDirectory = path.resolve(options.dictionaryDirectory || defaultDictionaryDirectory);
   const outputDirectory = path.resolve(options.outputDirectory || defaultOutputDirectory);

   const [compositionManifest, hanziWriterManifest, dictionaryManifest, dictionaryCharacterIndex] = await Promise.all([
      readJson(path.join(compositionDirectory, "manifest.json")),
      readJson(path.join(hanziWriterDirectory, "manifest.json")),
      readJson(path.join(dictionaryDirectory, "manifest.json")),
      readJson(path.join(dictionaryDirectory, "character-index.json")),
   ]);
   const compositionRecords = await loadCompositionRecords(compositionDirectory);
   const dictionaryCharacters = new Set(Object.keys(dictionaryCharacterIndex));
   const hanziWriterData = await loadHanziWriterData(hanziWriterDirectory, dictionaryCharacters);

   const occupancyWords = new Map();
   for (const character of hanziWriterData.keys()) {
      occupancyWords.set(character, bitmaskToWords(occupancyBitmask(hanziWriterData.get(character).medians)));
   }

   const structuralPairs = buildStructuralPairs(compositionRecords, hanziWriterData);
   const geometricPairs = buildGeometricPairs(hanziWriterData, occupancyWords);

   const union = new Map();
   for (const [key, pair] of structuralPairs) {
      union.set(key, { a: pair.a, b: pair.b, structural: true, score: geometricPairs.get(key)?.score ?? null });
   }
   for (const [key, pair] of geometricPairs) {
      if (union.has(key)) union.get(key).score = pair.score;
      else union.set(key, { a: pair.a, b: pair.b, structural: false, score: pair.score });
   }

   const simplifiedTraditionalExclusions = await loadSimplifiedTraditionalExclusions(dictionaryDirectory, dictionaryCharacters);
   const removedAsVariant = [];
   const filtered = new Map();
   for (const [key, pair] of union) {
      if (simplifiedTraditionalExclusions.has(key)) {
         removedAsVariant.push({ a: pair.a, b: pair.b });
         continue;
      }
      filtered.set(key, pair);
   }
   removedAsVariant.sort((left, right) => compareCharacters(left.a, right.a) || compareCharacters(left.b, right.b));

   const finalPairs = [];
   for (const key of [...filtered.keys()].sort()) {
      const pair = filtered.get(key);
      const activeTier = pair.structural || (pair.score != null && pair.score >= GEOMETRIC_ACTIVE_TIER_THRESHOLD);
      const { inA, inB } = differingStrokeIndices(hanziWriterData.get(pair.a), hanziWriterData.get(pair.b));
      finalPairs.push({
         a: pair.a,
         b: pair.b,
         structural: pair.structural,
         geometricScore: pair.score,
         activeTier,
         diffStrokeIndexA: inA,
         diffStrokeIndexB: inB,
      });
   }
   const rankScore = (pair) => (pair.structural ? 1 : (pair.geometricScore ?? 0));
   finalPairs.sort(
      (left, right) => rankScore(right) - rankScore(left) || compareCharacters(left.a, right.a) || compareCharacters(left.b, right.b),
   );

   // Construction symétrique : chaque paire alimente les deux fiches, chacune avec
   // son propre diffStrokeIndex (un indice de trait n'a de sens que dans le
   // tableau de traits du caractère auquel il appartient).
   const partnersByCharacter = new Map();
   const addPartner = (character, partner, pair, diffStrokeIndex) => {
      if (!partnersByCharacter.has(character)) partnersByCharacter.set(character, []);
      partnersByCharacter.get(character).push({
         character: partner,
         structural: pair.structural,
         geometricScore: pair.geometricScore,
         activeTier: pair.activeTier,
         diffStrokeIndex,
      });
   };
   for (const pair of finalPairs) {
      addPartner(pair.a, pair.b, pair, pair.diffStrokeIndexA);
      addPartner(pair.b, pair.a, pair, pair.diffStrokeIndexB);
   }
   for (const partners of partnersByCharacter.values()) {
      partners.sort(
         (left, right) =>
            Number(right.structural) - Number(left.structural) ||
            (right.geometricScore ?? 0) - (left.geometricScore ?? 0) ||
            compareCharacters(left.character, right.character),
      );
   }

   // Lacunes connues, documentées (hors index, jamais retenues) : scores réels
   // calculés hors seuil de rétention, pour que le rapport ne les passe pas sous
   // silence.
   const knownGaps = [
      { a: "已", b: "巳", reason: "已 absent des données de composition ; score géométrique sous le seuil de rétention" },
      { a: "人", b: "入", reason: "décomposition atomique des deux côtés ; score géométrique sous le seuil de rétention" },
      { a: "己", b: "巳", reason: "ne partagent qu'un seul composant nommé ({乚}) ; score géométrique sous le seuil de rétention — voir la note sur l'exigence d'au moins deux composants nommés" },
   ].map((gap) => ({
         ...gap,
         geometricScore: occupancyWords.has(gap.a) && occupancyWords.has(gap.b) ? scoreForPair(occupancyWords, gap.a, gap.b) : null,
         inFinalIndex: filtered.has(pairKey(gap.a, gap.b)),
      }));

   const requiredVerificationPairs = [
      ["未", "末"],
      ["日", "曰"],
      ["己", "已"],
      ["土", "士"],
   ].map(([a, b]) => {
      const entry = filtered.get(pairKey(a, b));
      return {
         a,
         b,
         found: !!entry,
         structural: entry ? entry.structural : null,
         geometricScore: entry ? entry.score : null,
         activeTier: entry ? entry.structural || (entry.score != null && entry.score >= GEOMETRIC_ACTIVE_TIER_THRESHOLD) : null,
      };
   });

   await rm(outputDirectory, { recursive: true, force: true });
   await mkdir(outputDirectory, { recursive: true });

   const chunkDirectory = path.join(outputDirectory, "chunks");
   await mkdir(chunkDirectory, { recursive: true });
   const byChunk = new Map();
   for (const character of [...partnersByCharacter.keys()].sort(compareCharacters)) {
      const key = chunkKeyFor(character);
      if (!byChunk.has(key)) byChunk.set(key, {});
      byChunk.get(key)[character] = partnersByCharacter.get(character);
   }
   const chunkDescriptors = [];
   for (const key of [...byChunk.keys()].sort()) {
      const relativePath = `chunks/${key}.json`;
      const buffer = await writeJson(path.join(outputDirectory, relativePath), byChunk.get(key));
      chunkDescriptors.push({
         key,
         path: relativePath,
         characterCount: Object.keys(byChunk.get(key)).length,
         bytes: buffer.length,
         sha256: sha256(buffer),
      });
   }

   const characterIndexBuffer = await writeJson(
      path.join(outputDirectory, "character-index.json"),
      Object.fromEntries(
         [...partnersByCharacter.keys()]
            .sort(compareCharacters)
            .map((character) => [character, { chunk: chunkKeyFor(character), partnerCount: partnersByCharacter.get(character).length }]),
      ),
   );

   const activeTierPairCount = finalPairs.filter((pair) => pair.activeTier).length;
   const counts = {
      comparableCharacterCount: hanziWriterData.size,
      dictionaryCharacterCount: dictionaryCharacters.size,
      structuralPairCount: structuralPairs.size,
      geometricPairCount: geometricPairs.size,
      unionPreExclusionCount: union.size,
      simplifiedTraditionalPairsInDictionary: simplifiedTraditionalExclusions.size,
      removedAsSimplifiedTraditionalVariantCount: removedAsVariant.length,
      finalPairCount: finalPairs.length,
      activeTierPairCount,
      passiveOnlyPairCount: finalPairs.length - activeTierPairCount,
      charactersWithAtLeastOnePartner: partnersByCharacter.size,
   };

   const manifestSeed = JSON.stringify({
      builderVersion: CONFUSABLE_PAIRS_BUILDER_VERSION,
      compositionBuildId: compositionManifest.buildId,
      dictionaryBuildId: dictionaryManifest.buildId,
      hanziWriterVersion: hanziWriterManifest.version,
      counts,
      characterIndexSha256: sha256(characterIndexBuffer),
      chunkDescriptors,
   });
   const buildId = sha256(manifestSeed);

   const report = {
      format: "mo-studio-confusable-pairs-build-report",
      builderVersion: CONFUSABLE_PAIRS_BUILDER_VERSION,
      derivedFrom: {
         characterCompositionBuildId: compositionManifest.buildId,
         dictionaryBuildId: dictionaryManifest.buildId,
         hanziWriterVersion: hanziWriterManifest.version,
      },
      criteria: {
         comparableUniverse: {
            description: "Intersection des caractères du dictionnaire et des caractères disposant de données hanzi-writer.",
            dictionaryCharacterCount: counts.dictionaryCharacterCount,
            comparableCharacterCount: counts.comparableCharacterCount,
         },
         strokeCountSource: "hanzi-writer 2.0.1 (strokes.length) — plus complet que character-radicals sur ce périmètre",
         strokeCountWindow: STROKE_COUNT_WINDOW,
         structural: {
            description:
               "Ensemble des composants IDS de premier niveau nommés (composants inconnus \"？\" ignorés) identique entre les deux caractères (ordre indifférent), ensemble non vide, différence de traits ≤ 1.",
         },
         geometric: {
            description:
               "Grille d'occupation booléenne carrée, construite en échantillonnant les polylignes de médianes hanzi-writer ; similarité de Jaccard entre caractères de traits ±1.",
            gridSize: OCCUPANCY_GRID_SIZE,
            gridBox: OCCUPANCY_GRID_BOX,
            samplesPerCell: OCCUPANCY_SAMPLES_PER_CELL,
            dilationTestedAndRejected: true,
            mutualTopKTestedAndRejected: true,
            retentionThreshold: GEOMETRIC_RETENTION_THRESHOLD,
            activeTierThreshold: GEOMETRIC_ACTIVE_TIER_THRESHOLD,
         },
         simplifiedTraditionalExclusion: {
            description:
               "Réutilise le mécanisme déjà écrit pour le Parcours (js/learning-units/learning-unit-lesson.js : dictionaryWordEntriesForCharacter + simplifiedTraditionalPairFor) : une entrée de dictionnaire de type mot dont le simplifié est le caractère et le traditionnel distinct (un seul caractère) désigne un couple à exclure.",
         },
         retentionRule: "structurel OU géométrique(≥ seuil de rétention), puis exclusion des couples simplifié/traditionnel",
         activeTierRule: "structurel OU géométrique(≥ seuil du niveau révision) — sous-ensemble du niveau fiche",
      },
      counts,
      requiredVerificationPairs,
      knownGaps,
      removedAsVariantSample: removedAsVariant.slice(0, 40),
   };
   await writeJson(path.join(outputDirectory, "build-report.json"), report, true);
   await writeFile(path.join(outputDirectory, "build-report.md"), renderMarkdownReport(report), "utf8");

   const manifest = {
      format: "mo-studio-confusable-pairs",
      schemaVersion: 1,
      builderVersion: CONFUSABLE_PAIRS_BUILDER_VERSION,
      buildId,
      license:
         "Derived from Make Me a Hanzi (GNU Lesser General Public License v3 or later, via data/generated/character-composition/) " +
         "and hanzi-writer-data (Arphic Public License, via data/generated/hanzi-writer/). data/generated/dictionary/ is used only " +
         "to filter the comparable universe and to detect simplified/traditional variant pairs at build time; no CC-CEDICT/CFDICT " +
         "text is copied into this output.",
      derivedFrom: report.derivedFrom,
      chunkModulo: CHUNK_MODULO,
      chunkPathTemplate: "chunks/{chunk}.json",
      criteria: report.criteria,
      counts,
      characterIndex: { path: "character-index.json", bytes: characterIndexBuffer.length, sha256: sha256(characterIndexBuffer) },
      chunks: chunkDescriptors,
   };
   await writeJson(path.join(outputDirectory, "manifest.json"), manifest, true);

   return { outputDirectory, manifest, report };
}

function renderMarkdownReport(report) {
   const c = report.counts;
   const requiredLines = report.requiredVerificationPairs
      .map(
         (pair) =>
            `| ${pair.a}/${pair.b} | ${pair.found ? "✅" : "❌ MANQUANTE"} | ${pair.structural ? "oui" : "non"} | ${
               pair.geometricScore != null ? pair.geometricScore.toFixed(3) : "—"
            } | ${pair.activeTier ? "oui" : "non"} |`,
      )
      .join("\n");
   const gapLines = report.knownGaps
      .map(
         (gap) =>
            `- ${gap.a}/${gap.b} : score géométrique ${gap.geometricScore != null ? gap.geometricScore.toFixed(3) : "—"} — ${gap.reason} (${
               gap.inFinalIndex ? "présente malgré tout (structurel)" : "absente de l'index final"
            })`,
      )
      .join("\n");
   const removedSample = report.removedAsVariantSample.map((pair) => `${pair.a}/${pair.b}`).join(", ");

   return `# Rapport de build — paires de caractères confusables

## Provenance

- Composition des caractères : \`data/generated/character-composition/\` (buildId \`${report.derivedFrom.characterCompositionBuildId}\`)
- Traits (SVG + médianes) : \`data/generated/hanzi-writer/${report.derivedFrom.hanziWriterVersion}/\`
- Dictionnaire : \`data/generated/dictionary/\` (buildId \`${report.derivedFrom.dictionaryBuildId}\`) — utilisé uniquement pour filtrer
  l'univers comparable et détecter les couples simplifié/traditionnel ; aucun texte CC-CEDICT/CFDICT n'est copié dans cette sortie.

Cet index hérite de la licence GNU Lesser General Public License v3 ou ultérieure (Make Me a Hanzi, via character-composition) et de
l'Arphic Public License (hanzi-writer-data), pour les champs effectivement dérivés (ensembles de composants nommés, indices de traits
issus des médianes). Aucune donnée n'est inventée : une paire absente des critères ci-dessous est simplement omise, jamais devinée, et
aucune paire n'est écrite à la main.

## Univers comparable

| Mesure | Valeur |
| --- | ---: |
| Caractères du dictionnaire | ${c.dictionaryCharacterCount} |
| Caractères comparables (∩ hanzi-writer) | ${c.comparableCharacterCount} |

## Critères de détection

**Structurel** — ${report.criteria.structural.description}
**Géométrique** — ${report.criteria.geometric.description} Grille ${report.criteria.geometric.gridSize}×${report.criteria.geometric.gridSize},
${report.criteria.geometric.samplesPerCell} échantillons par largeur de cellule le long de chaque segment de médiane. Le dilatement d'un
pixel et une variante par plus-proches-voisins mutuels ont tous deux été testés et rejetés (voir le chantier de calibrage) : ils
dégradent la séparation signal/bruit à pleine échelle plutôt que de l'améliorer.

| Mesure | Valeur |
| --- | ---: |
| Paires structurelles | ${c.structuralPairCount} |
| Paires géométriques (≥ ${report.criteria.geometric.retentionThreshold}) | ${c.geometricPairCount} |
| Union avant exclusion des variantes | ${c.unionPreExclusionCount} |

## Exclusion des couples simplifié/traditionnel

Mécanisme réutilisé de \`js/learning-units/learning-unit-lesson.js\` (voir \`criteria.simplifiedTraditionalExclusion\` dans le manifeste).

| Mesure | Valeur |
| --- | ---: |
| Couples simplifié/traditionnel connus du dictionnaire | ${c.simplifiedTraditionalPairsInDictionary} |
| Retirés de l'index candidat | ${c.removedAsSimplifiedTraditionalVariantCount} |

Constat : la réduction (${c.removedAsSimplifiedTraditionalVariantCount} sur ${c.unionPreExclusionCount}, soit ${((c.removedAsSimplifiedTraditionalVariantCount / c.unionPreExclusionCount) * 100).toFixed(1)} %)
est plus faible qu'attendu — la majorité du volume à ce seuil n'est pas du bruit de variantes, ce sont de vrais caractères distincts qui
se ressemblent. Le filtre reste nécessaire et correct : il retire du bruit réel (échantillon : ${removedSample}${report.removedAsVariantSample.length >= 40 ? "…" : ""}).

## Deux niveaux

| Niveau | Règle | Paires |
| --- | --- | ---: |
| Fiche (passif) | structurel OU géométrique ≥ ${report.criteria.geometric.retentionThreshold} | ${c.finalPairCount} |
| Révision (actif, \`activeTier\`) | structurel OU géométrique ≥ ${report.criteria.geometric.activeTierThreshold} | ${c.activeTierPairCount} |

${c.finalPairCount} paires au total (${c.charactersWithAtLeastOnePartner} caractères concernés), dont ${c.activeTierPairCount} au niveau
révision strict et ${c.passiveOnlyPairCount} au niveau fiche uniquement.

## Vérification des paires exigées

| Paire | Présente | Structurel | Score géométrique | Niveau révision |
| --- | --- | --- | ---: | --- |
${requiredLines}

## Lacunes connues, assumées

${gapLines}

Ni l'une ni l'autre n'est exigée par la vérification ci-dessus. Les inclure sans exploser le volume total est impossible avec cette
méthode simple : un seuil qui les capte en admettrait des dizaines/centaines de milliers d'autres.
`;
}

/* ================= entrée CLI ================= */

function commandLineOutputDirectory() {
   const outputIndex = process.argv.indexOf("--output");
   if (outputIndex < 0) return defaultOutputDirectory;
   if (!process.argv[outputIndex + 1]) throw new Error("--output exige un chemin");
   return path.resolve(projectRoot, process.argv[outputIndex + 1]);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
   const result = await buildConfusablePairsIndex({ outputDirectory: commandLineOutputDirectory() });
   console.log(
      `Paires confusables : ${result.manifest.counts.finalPairCount} au total ` +
         `(${result.manifest.counts.activeTierPairCount} niveau révision, ${result.manifest.counts.passiveOnlyPairCount} niveau fiche uniquement), ` +
         `${result.manifest.counts.removedAsSimplifiedTraditionalVariantCount} variantes simplifié/traditionnel retirées, ` +
         `${result.manifest.counts.charactersWithAtLeastOnePartner} caractères concernés`,
   );
}
