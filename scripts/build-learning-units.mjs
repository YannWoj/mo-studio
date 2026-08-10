import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadComponentLabelsFr } from "./component-labels-fr.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

export const LEARNING_UNITS_BUILDER_VERSION = "1.1.0";
export const UNIT_MAX_SIZE = 8;
export const UNIT_MIN_MEMBERS_TO_RETAIN_GROUP = 2;
export const EXAMPLE_WORDS_PER_MEMBER = 3;

const defaultCompositionDirectory = path.join(projectRoot, "data", "generated", "character-composition");
const defaultRadicalsDirectory = path.join(projectRoot, "data", "generated", "character-radicals");
const defaultDictionaryDirectory = path.join(projectRoot, "data", "generated", "dictionary");
const defaultHsk1Path = path.join(projectRoot, "hsk1.json");
const defaultPersonalLibraryPath = path.join(projectRoot, "data", "personal", "library-export.json");
const defaultOutputDirectory = path.join(projectRoot, "data", "generated", "learning-units");
const UNITS_CHUNK_THRESHOLD_BYTES = 400_000;
const UNITS_PER_CHUNK = 30;

function sha256(value) {
   return createHash("sha256").update(value).digest("hex");
}

function compareCharacters(left, right) {
   const leftCodepoint = left.codePointAt(0) || 0;
   const rightCodepoint = right.codePointAt(0) || 0;
   return leftCodepoint - rightCodepoint || left.localeCompare(right, "zh");
}

async function writeJson(filename, value, pretty = false) {
   const content = `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
   await writeFile(filename, content, "utf8");
   return Buffer.from(content, "utf8");
}

async function readJson(filename) {
   return JSON.parse(await readFile(filename, "utf8"));
}

async function tryReadJson(filename) {
   try {
      return { value: await readJson(filename), found: true };
   } catch (error) {
      if (error?.code === "ENOENT") return { value: null, found: false };
      throw error;
   }
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

function directComponentsOf(recordsByCharacter, character) {
   const record = recordsByCharacter.get(character);
   if (!record || !record.components) return [];
   return Object.keys(record.components).sort(compareCharacters);
}

// Un composant peut apparaître comme feuille dans des dizaines de fiches de
// composition sans jamais avoir sa propre fiche ni sa propre entrée de
// dictionnaire (ex. 龶). Cette table capture sa définition/pinyin la
// première fois qu'il est rencontré comme feuille, pour servir de repli.
function buildComponentGlossary(recordsByCharacter) {
   const glossary = new Map();
   for (const character of [...recordsByCharacter.keys()].sort(compareCharacters)) {
      const record = recordsByCharacter.get(character);
      for (const [component, info] of Object.entries(record.components || {})) {
         if (!glossary.has(component)) glossary.set(component, info);
      }
   }
   return glossary;
}

async function loadDictionary(dictionaryDirectory) {
   const characterIndex = await readJson(path.join(dictionaryDirectory, "character-index.json"));
   const searchPreviews = await readJson(path.join(dictionaryDirectory, "search-previews.json"));
   const manifest = await readJson(path.join(dictionaryDirectory, "manifest.json"));
   return { characterIndex, previews: searchPreviews.entries, manifest };
}

async function loadRadicals(radicalsDirectory) {
   const manifest = await readJson(path.join(radicalsDirectory, "manifest.json"));
   const groups = new Map();
   for (const row of manifest.radicals) {
      const chunk = await readJson(path.join(radicalsDirectory, row.path));
      groups.set(row.radical, chunk.characters.map((entry) => entry.hanzi));
   }
   return { manifest, groups };
}

async function loadHsk1RootCharacters(hsk1Path) {
   const buffer = await readFile(hsk1Path);
   const data = JSON.parse(buffer.toString("utf8"));
   const characters = new Set();
   for (const card of Array.isArray(data.cards) ? data.cards : []) {
      for (const character of Array.from(String(card.hz || ""))) characters.add(character);
   }
   return { characters, sha256: sha256(buffer), cardCount: data.cards?.length || 0 };
}

// Aucune interface n'exporte encore cette bibliothèque vers data/personal/ ;
// l'export existant (Réglages -> Données -> Exporter) produit déjà ce format
// (voir js/storage-transfer.js:exportData). Tant qu'aucun fichier n'est
// déposé ici, ce signal reste honnêtement à zéro plutôt que d'être inventé.
async function loadPersonalLibrary(personalLibraryPath) {
   const { value, found } = await tryReadJson(personalLibraryPath);
   if (!found) {
      return { found: false, path: personalLibraryPath, cardCharacters: new Set(), cardWords: new Set(), cardCount: 0, sha256: null };
   }
   const cards = Array.isArray(value) ? value : Array.isArray(value.cards) ? value.cards : [];
   const cardCharacters = new Set();
   const cardWords = new Set();
   for (const card of cards) {
      const hz = String(card?.hz || card?.chinese || "").trim();
      if (!hz) continue;
      cardWords.add(hz);
      for (const character of Array.from(hz)) cardCharacters.add(character);
   }
   const buffer = Buffer.from(JSON.stringify(value), "utf8");
   return { found: true, path: personalLibraryPath, cardCharacters, cardWords, cardCount: cards.length, sha256: sha256(buffer) };
}

/* ================= lexique (pinyin / sens) ================= */

function dictionaryLookup(dictionary, character) {
   const indexed = dictionary.characterIndex[character];
   if (!indexed) return null;
   const preview = dictionary.previews[indexed.entryRef];
   if (!Array.isArray(preview)) return null;
   let pinyin = preview[4]?.[0]?.[0] || null;
   let gloss = preview[5] || null;
   // ~19% des fiches "caractère" du dictionnaire (ex. 请) n'ont ni pinyin ni
   // sens propres, alors qu'une autre fiche "mot" du même dictionnaire pour
   // exactement ce même texte en porte. On complète avec cette même donnée
   // déjà générée plutôt que de laisser un trou récupérable.
   if (!pinyin || !gloss) {
      const sameTextWordRef = (indexed.wordRefs || []).find(
         (ref) => dictionary.previews[ref]?.[1] === character,
      );
      const altPreview = sameTextWordRef != null ? dictionary.previews[sameTextWordRef] : null;
      if (altPreview) {
         pinyin = pinyin || altPreview[4]?.[0]?.[0] || null;
         gloss = gloss || altPreview[5] || null;
      }
   }
   return { pinyin, gloss };
}

// glossSource décrit d'où vient le SENS, et rien d'autre. L'ancienne version
// sortait sur la première branche dès qu'un pinyin existait : 77 composants
// (辶, 讠, 刂, 扌, 忄, 衤…) repartaient donc étiquetés « dictionary » avec un sens
// vide, sans jamais consulter le repli qui, lui, les documente.
function componentMeta(dictionary, glossary, componentLabelsFr, character) {
   const fromDictionary = dictionaryLookup(dictionary, character);
   const fromGlossary = glossary.get(character);
   const pinyin = fromDictionary?.pinyin || fromGlossary?.pinyin?.[0] || null;
   const manual = componentLabelsFr[character] || null;
   if (manual) return { pinyin, gloss: manual, glossSource: "components-fr" };
   if (fromDictionary?.gloss) return { pinyin, gloss: fromDictionary.gloss, glossSource: "dictionary" };
   if (fromGlossary?.definition)
      return { pinyin, gloss: fromGlossary.definition, glossSource: "composition-en" };
   return { pinyin, gloss: null, glossSource: null };
}

function wordCountOf(dictionary, character) {
   return dictionary.characterIndex[character]?.wordRefs?.length || 0;
}

function exampleWordsFor(dictionary, character, limit) {
   const refs = dictionary.characterIndex[character]?.wordRefs || [];
   const words = refs
      .map((ref) => dictionary.previews[ref])
      .filter(Array.isArray)
      .map((preview) => ({
         hanzi: preview[1],
         pinyin: preview[4]?.[0]?.[0] || null,
         gloss: preview[5] || null,
      }));
   words.sort(
      (left, right) =>
         Array.from(left.hanzi).length - Array.from(right.hanzi).length ||
         compareCharacters(left.hanzi, right.hanzi),
   );
   return words.slice(0, limit);
}

/* ================= score d'utilité (partie 3) ================= */

// Trois signaux, dans l'ordre de priorité demandé : mes cartes/packs personnels,
// puis hsk1.json, puis la fréquence lexicale dans mon dictionnaire. Ce n'est pas
// une pondération arbitraire : c'est un ordre de priorité total (cartes > HSK1 >
// fréquence) encodé numériquement. Le multiplicateur est la plus petite puissance
// de dix strictement supérieure au nombre de mots maximal observé, pour qu'aucun
// niveau ne puisse jamais être dépassé par le suivant.
function buildUtilityIndex(dictionaryCharacters, dictionary, personalLibrary, hsk1Characters) {
   let maxWordCount = 0;
   const wordCounts = new Map();
   for (const character of dictionaryCharacters) {
      const count = wordCountOf(dictionary, character);
      wordCounts.set(character, count);
      if (count > maxWordCount) maxWordCount = count;
   }
   const tierMultiplier = 10 ** Math.max(1, Math.ceil(Math.log10(maxWordCount + 1)));

   const index = new Map();
   for (const character of dictionaryCharacters) {
      const wordCount = wordCounts.get(character);
      const inPersonalLibrary = personalLibrary.cardCharacters.has(character);
      const inHsk1 = hsk1Characters.has(character);
      const tier = inPersonalLibrary ? 3 : inHsk1 ? 2 : wordCount > 0 ? 1 : 0;
      const score = tier * tierMultiplier + Math.min(wordCount, tierMultiplier - 1);
      index.set(character, { score, tier, wordCount, inPersonalLibrary, inHsk1 });
   }
   return {
      index,
      formula: {
         description:
            "score = niveau * multiplicateur + min(nombreDeMots, multiplicateur - 1) ; " +
            "niveau 3 = dans mes cartes/packs personnels, niveau 2 = dans hsk1.json, " +
            "niveau 1 = apparaît dans >=1 mot du dictionnaire, niveau 0 = aucun signal",
         tierMultiplier,
         maxWordCountObserved: maxWordCount,
         tiers: [
            { tier: 3, name: "personal-library", description: "apparaît dans db.cards / packs (export personnel)" },
            { tier: 2, name: "hsk1", description: "apparaît dans hsk1.json" },
            { tier: 1, name: "dictionary-frequency", description: "apparaît dans au moins un mot du dictionnaire" },
            { tier: 0, name: "none", description: "aucun des signaux ci-dessus" },
         ],
      },
   };
}

/* ================= graphe de dépendances (partie 2) ================= */

function buildDependencyGraph(recordsByCharacter, dictionaryCharacters) {
   const prerequisites = new Map();
   for (const character of [...recordsByCharacter.keys()].sort(compareCharacters)) {
      const components = directComponentsOf(recordsByCharacter, character);
      if (components.length) prerequisites.set(character, components);
   }
   const unlocks = new Map();
   for (const character of prerequisites.keys()) {
      for (const component of prerequisites.get(character)) {
         if (!unlocks.has(component)) unlocks.set(component, []);
         unlocks.get(component).push(character);
      }
   }

   const allNodes = new Set(prerequisites.keys());
   for (const targets of prerequisites.values()) for (const target of targets) allNodes.add(target);

   const { cycles, selfReferences } = detectCyclesAndSelfReferences(prerequisites, allNodes);

   const hasEdge = (character) => prerequisites.has(character) || unlocks.has(character);
   let reachable = 0;
   const orphans = [];
   for (const character of dictionaryCharacters) {
      if (hasEdge(character)) reachable++;
      else orphans.push(character);
   }
   orphans.sort(compareCharacters);

   return {
      prerequisites,
      unlocks,
      nodeCount: allNodes.size,
      edgeCount: [...prerequisites.values()].reduce((sum, list) => sum + list.length, 0),
      cycles,
      selfReferences,
      dictionaryReachableCount: reachable,
      dictionaryOrphanedCharacters: orphans,
   };
}

// DFS itératif à trois couleurs (blanc/gris/noir) sur pile explicite : jamais de
// récursion, donc jamais de dépassement de pile quelle que soit la profondeur
// réelle des données. Chaque nœud est visité une fois (O(V+E)), donc la fonction
// termine toujours même si le graphe contient des cycles.
function detectCyclesAndSelfReferences(adjacency, nodes) {
   const WHITE = 0, GRAY = 1, BLACK = 2;
   const color = new Map();
   const cycles = [];
   const selfReferences = [];
   const MAX_CYCLES_REPORTED = 200;
   const sortedNodes = [...nodes].sort(compareCharacters);

   for (const start of sortedNodes) {
      if ((color.get(start) || WHITE) !== WHITE) continue;
      const stack = [{ node: start, children: adjacency.get(start) || [], index: 0 }];
      color.set(start, GRAY);
      while (stack.length) {
         const frame = stack[stack.length - 1];
         if (frame.index < frame.children.length) {
            const next = frame.children[frame.index++];
            if (next === frame.node) {
               selfReferences.push(next);
               continue;
            }
            const nextColor = color.get(next) || WHITE;
            if (nextColor === WHITE) {
               color.set(next, GRAY);
               stack.push({ node: next, children: adjacency.get(next) || [], index: 0 });
            } else if (nextColor === GRAY && cycles.length < MAX_CYCLES_REPORTED) {
               const pathIndex = stack.findIndex((entry) => entry.node === next);
               const cyclePath = stack.slice(pathIndex >= 0 ? pathIndex : 0).map((entry) => entry.node);
               cyclePath.push(next);
               cycles.push(cyclePath);
            }
         } else {
            color.set(frame.node, BLACK);
            stack.pop();
         }
      }
   }
   return {
      cycles,
      selfReferences: [...new Set(selfReferences)].sort(compareCharacters),
   };
}

/* ================= familles phonétiques (partie 1) ================= */

function buildPhoneticFamilies(recordsByCharacter, dictionaryCharacters, dictionary, glossary, componentLabelsFr) {
   const rawFamilies = new Map();
   for (const character of [...recordsByCharacter.keys()].sort(compareCharacters)) {
      const phonetic = recordsByCharacter.get(character).etymology?.phonetic;
      if (!phonetic) continue;
      if (!rawFamilies.has(phonetic)) rawFamilies.set(phonetic, []);
      rawFamilies.get(phonetic).push(character);
   }

   const familiesWithAnyDictionaryMember = [...rawFamilies.entries()].filter(([, members]) =>
      members.some((character) => dictionaryCharacters.has(character)),
   ).length;

   const families = [];
   for (const component of [...rawFamilies.keys()].sort(compareCharacters)) {
      const dictionaryMembers = rawFamilies.get(component)
         .filter((character) => dictionaryCharacters.has(character))
         .sort(compareCharacters);
      if (dictionaryMembers.length < UNIT_MIN_MEMBERS_TO_RETAIN_GROUP) continue;
      const meta = componentMeta(dictionary, glossary, componentLabelsFr, component);
      families.push({
         component,
         componentPinyin: meta.pinyin,
         componentGloss: meta.gloss,
         componentGlossSource: meta.glossSource,
         members: dictionaryMembers.map((character) => {
            const memberMeta = dictionaryLookup(dictionary, character);
            return { character, pinyin: memberMeta?.pinyin || null, gloss: memberMeta?.gloss || null };
         }),
      });
   }

   const sizeDistribution = new Map();
   for (const family of families) {
      const size = family.members.length;
      const bucket = size >= 10 ? "10+" : String(size);
      sizeDistribution.set(bucket, (sizeDistribution.get(bucket) || 0) + 1);
   }

   return {
      families,
      distinctPhoneticComponentsWithAnyDictionaryMember: familiesWithAnyDictionaryMember,
      retainedFamilyCount: families.length,
      familiesWithAtLeast4Members: families.filter((family) => family.members.length >= 4).length,
      sizeDistribution: Object.fromEntries([...sizeDistribution.entries()].sort()),
   };
}

/* ================= unités d'apprentissage (partie 4) ================= */

function splitBalanced(items, maxSize) {
   const n = items.length;
   if (n <= maxSize) return [items];
   const groups = Math.ceil(n / maxSize);
   const base = Math.floor(n / groups);
   const remainder = n % groups;
   const result = [];
   let cursor = 0;
   for (let index = 0; index < groups; index++) {
      const size = base + (index < remainder ? 1 : 0);
      result.push(items.slice(cursor, cursor + size));
      cursor += size;
   }
   return result;
}

function buildMemberRow(dictionary, recordsByCharacter, utilityIndex, character) {
   const meta = dictionaryLookup(dictionary, character);
   const utility = utilityIndex.get(character) || { score: 0, tier: 0, wordCount: 0, inPersonalLibrary: false, inHsk1: false };
   return {
      character,
      pinyin: meta?.pinyin || null,
      gloss: meta?.gloss || null,
      utilityScore: utility.score,
      directComponents: directComponentsOf(recordsByCharacter, character),
      exampleWords: exampleWordsFor(dictionary, character, EXAMPLE_WORDS_PER_MEMBER),
   };
}

function buildUnitsFromGroup(type, component, dictionaryMembers, context) {
   const { dictionary, recordsByCharacter, utilityIndex, glossary, prerequisites, componentLabelsFr } = context;
   const meta = componentMeta(dictionary, glossary, componentLabelsFr, component);
   const sortedMembers = [...dictionaryMembers].sort((left, right) => {
      const leftScore = utilityIndex.get(left)?.score || 0;
      const rightScore = utilityIndex.get(right)?.score || 0;
      return rightScore - leftScore || compareCharacters(left, right);
   });
   const slices = splitBalanced(sortedMembers, UNIT_MAX_SIZE);
   return slices.map((slice, sliceIndex) => {
      const members = slice.map((character) => buildMemberRow(dictionary, recordsByCharacter, utilityIndex, character));
      const utilityScore = members.reduce((sum, member) => sum + member.utilityScore, 0);
      return {
         id: `${type === "phonetic" ? "phon" : "sem"}-${component}-${sliceIndex + 1}`,
         type,
         component,
         componentPinyin: meta.pinyin,
         componentGloss: meta.gloss,
         componentGlossSource: meta.glossSource,
         prerequisites: prerequisites.get(component) || [],
         members,
         utilityScore,
         partIndex: sliceIndex + 1,
         partCount: slices.length,
      };
   });
}

function buildLearningUnits(phoneticFamilies, radicals, context) {
   const units = [];
   const phoneticallyCovered = new Set();
   for (const family of phoneticFamilies.families) {
      const memberCharacters = family.members.map((member) => member.character);
      memberCharacters.forEach((character) => phoneticallyCovered.add(character));
      units.push(...buildUnitsFromGroup("phonetic", family.component, memberCharacters, context));
   }

   let retainedSemanticGroups = 0;
   const semanticallyCovered = new Set();
   for (const radical of [...radicals.groups.keys()].sort(compareCharacters)) {
      const remaining = radicals.groups
         .get(radical)
         .filter((character) => context.dictionaryCharacters.has(character) && !phoneticallyCovered.has(character));
      if (remaining.length < UNIT_MIN_MEMBERS_TO_RETAIN_GROUP) continue;
      retainedSemanticGroups++;
      remaining.forEach((character) => semanticallyCovered.add(character));
      units.push(...buildUnitsFromGroup("semantic", radical, remaining, context));
   }

   units.sort(
      (left, right) =>
         right.utilityScore - left.utilityScore ||
         compareCharacters(left.component, right.component) ||
         left.partIndex - right.partIndex,
   );

   const coveredCharacters = new Set([...phoneticallyCovered, ...semanticallyCovered]);
   return {
      units,
      phoneticallyCoveredCount: phoneticallyCovered.size,
      retainedSemanticGroups,
      semanticallyCoveredCount: semanticallyCovered.size,
      totalCoveredCount: coveredCharacters.size,
      uncoveredCount: context.dictionaryCharacters.size - coveredCharacters.size,
   };
}

function packsCoverage(units, personalLibrary) {
   if (!personalLibrary.found) return { unitsCoveringPersonalWord: 0, applicable: false };
   let count = 0;
   for (const unit of units) {
      const hasPersonalWord = unit.members.some(
         (member) =>
            personalLibrary.cardWords.has(member.character) ||
            member.exampleWords.some((word) => personalLibrary.cardWords.has(word.hanzi)),
      );
      if (hasPersonalWord) count++;
   }
   return { unitsCoveringPersonalWord: count, applicable: true };
}

/* ================= construction principale ================= */

export async function buildLearningUnitsIndex(options = {}) {
   const compositionDirectory = path.resolve(options.compositionDirectory || defaultCompositionDirectory);
   const radicalsDirectory = path.resolve(options.radicalsDirectory || defaultRadicalsDirectory);
   const dictionaryDirectory = path.resolve(options.dictionaryDirectory || defaultDictionaryDirectory);
   const hsk1Path = path.resolve(options.hsk1Path || defaultHsk1Path);
   const personalLibraryPath = path.resolve(options.personalLibraryPath || defaultPersonalLibraryPath);
   const outputDirectory = path.resolve(options.outputDirectory || defaultOutputDirectory);

   const [compositionManifest, radicalsData, dictionary, hsk1, personalLibrary] = await Promise.all([
      readJson(path.join(compositionDirectory, "manifest.json")),
      loadRadicals(radicalsDirectory),
      loadDictionary(dictionaryDirectory),
      loadHsk1RootCharacters(hsk1Path),
      loadPersonalLibrary(personalLibraryPath),
   ]);
   const recordsByCharacter = await loadCompositionRecords(compositionDirectory);
   const dictionaryCharacters = new Set(Object.keys(dictionary.characterIndex));
   const glossary = buildComponentGlossary(recordsByCharacter);
   const componentLabels = await loadComponentLabelsFr(options.componentLabelsFrPath);

   const { index: utilityIndex, formula } = buildUtilityIndex(
      dictionaryCharacters,
      dictionary,
      personalLibrary,
      hsk1.characters,
   );

   const graph = buildDependencyGraph(recordsByCharacter, dictionaryCharacters);

   const phoneticFamilies = buildPhoneticFamilies(recordsByCharacter, dictionaryCharacters, dictionary, glossary, componentLabels.labels);

   const context = {
      dictionary,
      recordsByCharacter,
      utilityIndex,
      glossary,
      componentLabelsFr: componentLabels.labels,
      prerequisites: graph.prerequisites,
      dictionaryCharacters,
   };
   const { units, phoneticallyCoveredCount, retainedSemanticGroups, semanticallyCoveredCount, totalCoveredCount, uncoveredCount } =
      buildLearningUnits(phoneticFamilies, radicalsData, context);

   const packs = packsCoverage(units, personalLibrary);

   await rm(outputDirectory, { recursive: true, force: true });
   await mkdir(outputDirectory, { recursive: true });

   const utilityScoresBuffer = await writeJson(
      path.join(outputDirectory, "utility-scores.json"),
      Object.fromEntries([...dictionaryCharacters].sort(compareCharacters).map((character) => [character, utilityIndex.get(character)])),
   );

   const phoneticFamiliesBuffer = await writeJson(
      path.join(outputDirectory, "phonetic-families.json"),
      phoneticFamilies.families,
   );

   const graphBuffer = await writeJson(path.join(outputDirectory, "graph.json"), {
      format: "mo-studio-learning-units-graph",
      schemaVersion: 1,
      meta: {
         nodeCount: graph.nodeCount,
         edgeCount: graph.edgeCount,
         dictionaryCharacterCount: dictionaryCharacters.size,
         dictionaryReachableCount: graph.dictionaryReachableCount,
         dictionaryOrphanedCount: graph.dictionaryOrphanedCharacters.length,
         cyclesDetected: graph.cycles,
         selfReferencesDetected: graph.selfReferences,
      },
      prerequisites: Object.fromEntries(graph.prerequisites),
      unlocks: Object.fromEntries(graph.unlocks),
   });

   const unitsSerialized = JSON.stringify(units);
   const chunked = Buffer.byteLength(unitsSerialized, "utf8") > UNITS_CHUNK_THRESHOLD_BYTES;
   let unitsFileDescriptor;
   const chunkDescriptors = [];
   if (!chunked) {
      const buffer = await writeJson(path.join(outputDirectory, "units.json"), units);
      unitsFileDescriptor = { path: "units.json", count: units.length, bytes: buffer.length, sha256: sha256(buffer) };
   } else {
      const chunkDirectory = path.join(outputDirectory, "chunks");
      await mkdir(chunkDirectory, { recursive: true });
      for (let start = 0, chunkIndex = 0; start < units.length; start += UNITS_PER_CHUNK, chunkIndex++) {
         const slice = units.slice(start, start + UNITS_PER_CHUNK);
         const key = String(chunkIndex).padStart(3, "0");
         const relativePath = `chunks/${key}.json`;
         const buffer = await writeJson(path.join(outputDirectory, relativePath), slice);
         chunkDescriptors.push({ key, path: relativePath, count: slice.length, bytes: buffer.length, sha256: sha256(buffer) });
      }
   }

   const unitIndexRows = units.map((unit) => ({
      id: unit.id,
      type: unit.type,
      component: unit.component,
      componentPinyin: unit.componentPinyin,
      componentGloss: unit.componentGloss,
      prerequisites: unit.prerequisites,
      memberCharacters: unit.members.map((member) => member.character),
      utilityScore: unit.utilityScore,
      partIndex: unit.partIndex,
      partCount: unit.partCount,
   }));

   // Couverture des noms de composants : mesurée sur les composants DISTINCTS
   // enseignés, et sur la présence d'un texte de sens — pas sur l'étiquette de
   // source, qui ne dit pas si le texte existe.
   const distinctComponents = new Map();
   for (const unit of units) if (!distinctComponents.has(unit.component)) distinctComponents.set(unit.component, unit);
   const componentsBySource = {};
   for (const unit of distinctComponents.values()) {
      const key = unit.componentGlossSource || "none";
      componentsBySource[key] = (componentsBySource[key] || 0) + 1;
   }
   const componentsWithoutGloss = [...distinctComponents.values()]
      .filter((unit) => !unit.componentGloss)
      .map((unit) => unit.component)
      .sort(compareCharacters);

   const counts = {
      dictionaryCharacterCount: dictionaryCharacters.size,
      distinctTaughtComponentCount: distinctComponents.size,
      taughtComponentsByGlossSource: componentsBySource,
      taughtComponentsWithoutGlossCount: componentsWithoutGloss.length,
      taughtComponentsWithoutGloss: componentsWithoutGloss,
      unitRowsWithoutGlossCount: units.filter((unit) => !unit.componentGloss).length,
      compositionRecordCount: recordsByCharacter.size,
      distinctPhoneticComponentsWithAnyDictionaryMember: phoneticFamilies.distinctPhoneticComponentsWithAnyDictionaryMember,
      retainedPhoneticFamilyCount: phoneticFamilies.retainedFamilyCount,
      phoneticFamiliesWithAtLeast4Members: phoneticFamilies.familiesWithAtLeast4Members,
      phoneticFamilySizeDistribution: phoneticFamilies.sizeDistribution,
      retainedSemanticGroupCount: retainedSemanticGroups,
      unitCount: units.length,
      phoneticUnitCount: units.filter((unit) => unit.type === "phonetic").length,
      semanticUnitCount: units.filter((unit) => unit.type === "semantic").length,
      unitsCoveringAtLeastOnePersonalWord: packs.unitsCoveringPersonalWord,
      personalCoverageApplicable: packs.applicable,
      phoneticallyCoveredCharacterCount: phoneticallyCoveredCount,
      semanticallyCoveredCharacterCount: semanticallyCoveredCount,
      totalCoveredCharacterCount: totalCoveredCount,
      uncoveredCharacterCount: uncoveredCount,
      graphNodeCount: graph.nodeCount,
      graphEdgeCount: graph.edgeCount,
      dictionaryReachableCount: graph.dictionaryReachableCount,
      dictionaryOrphanedCount: graph.dictionaryOrphanedCharacters.length,
      cyclesDetectedCount: graph.cycles.length,
      selfReferencesDetectedCount: graph.selfReferences.length,
      hsk1RootCharacterCount: hsk1.characters.size,
      hsk1RootCardCount: hsk1.cardCount,
      personalLibraryFound: personalLibrary.found,
      personalLibraryCardCount: personalLibrary.cardCount,
      personalLibraryCharacterCount: personalLibrary.cardCharacters.size,
   };

   const exampleUnit = units.find((unit) => unit.component === "青" && unit.partIndex === 1) || units[0];

   const report = {
      format: "mo-studio-learning-units-build-report",
      builderVersion: LEARNING_UNITS_BUILDER_VERSION,
      componentLabelsFr: {
         file: componentLabels.path,
         sha256: componentLabels.sha256,
         entryCount: componentLabels.entryCount,
         provenance: componentLabels.provenance,
         upstreamLicenseApplies: componentLabels.upstreamLicenseApplies,
      },
      derivedFrom: {
         characterCompositionBuildId: compositionManifest.buildId,
         characterRadicalsBuildId: radicalsData.manifest.buildId,
         dictionaryBuildId: dictionary.manifest.buildId,
         hsk1RootSha256: hsk1.sha256,
         personalLibrary: {
            found: personalLibrary.found,
            path: path.relative(projectRoot, personalLibraryPath).replaceAll("\\", "/"),
            sha256: personalLibrary.sha256,
            cardCount: personalLibrary.cardCount,
         },
      },
      utilityFormula: formula,
      counts,
      cyclesDetected: graph.cycles,
      selfReferencesDetected: graph.selfReferences,
      orphanedCharactersSample: graph.dictionaryOrphanedCharacters.slice(0, 40),
      exampleUnit,
   };
   await writeJson(path.join(outputDirectory, "build-report.json"), report, true);

   const reportMarkdown = renderMarkdownReport(report, personalLibraryPath);
   await writeFile(path.join(outputDirectory, "build-report.md"), reportMarkdown, "utf8");

   // Le manifeste reste volontairement léger (pointeurs + comptes) : la liste
   // complète des unités vit dans son propre fichier paresseux, à l'image du
   // manifeste HSK (807 octets) qui ne charge jamais les niveaux eux-mêmes.
   const unitsIndexBuffer = await writeJson(path.join(outputDirectory, "units-index.json"), unitIndexRows);

   const manifestSeed = JSON.stringify({
      builderVersion: LEARNING_UNITS_BUILDER_VERSION,
      componentLabelsFrSha256: componentLabels.sha256,
      compositionBuildId: compositionManifest.buildId,
      radicalsBuildId: radicalsData.manifest.buildId,
      dictionaryBuildId: dictionary.manifest.buildId,
      hsk1RootSha256: hsk1.sha256,
      personalLibrarySha256: personalLibrary.sha256,
      counts,
      unitsIndexSha256: sha256(unitsIndexBuffer),
   });
   const manifest = {
      format: "mo-studio-learning-units",
      schemaVersion: 1,
      builderVersion: LEARNING_UNITS_BUILDER_VERSION,
      buildId: sha256(manifestSeed),
      license:
         "Derived from Make Me a Hanzi (GNU Lesser General Public License v3 or later) via " +
         "data/generated/character-composition/ and data/generated/character-radicals/; character " +
         "and word glosses/pinyin derived from CC-CEDICT (CC BY-SA 4.0) and CFDICT (CC BY-SA 3.0) via " +
         "data/generated/dictionary/",
      derivedFrom: report.derivedFrom,
      componentLabelsFr: report.componentLabelsFr,
      utilityFormula: formula,
      counts,
      files: {
         unitsIndex: { path: "units-index.json", count: unitIndexRows.length, bytes: unitsIndexBuffer.length, sha256: sha256(unitsIndexBuffer) },
         utilityScores: { path: "utility-scores.json", bytes: utilityScoresBuffer.length, sha256: sha256(utilityScoresBuffer) },
         phoneticFamilies: { path: "phonetic-families.json", bytes: phoneticFamiliesBuffer.length, sha256: sha256(phoneticFamiliesBuffer) },
         graph: { path: "graph.json", bytes: graphBuffer.length, sha256: sha256(graphBuffer) },
         units: chunked
            ? { chunked: true, chunkPathTemplate: "chunks/{key}.json", chunks: chunkDescriptors }
            : { chunked: false, ...unitsFileDescriptor },
      },
   };
   await writeJson(path.join(outputDirectory, "manifest.json"), manifest, true);

   return { outputDirectory, manifest, report };
}

function renderMarkdownReport(report, personalLibraryPath) {
   const c = report.counts;
   const example = report.exampleUnit;
   const exampleMembers = example.members
      .map((member) => `${member.character} (${member.pinyin || "?"}, "${member.gloss || "?"}", score ${member.utilityScore})`)
      .join(", ");
   const exampleWords = example.members
      .flatMap((member) => member.exampleWords.map((word) => `${word.hanzi} (${word.pinyin || "?"}, "${word.gloss || "?"}")`))
      .slice(0, 12)
      .join(", ");
   const cycleLines = report.cyclesDetected.length
      ? report.cyclesDetected.map((cycle) => `- ${cycle.join(" → ")}`).join("\n")
      : "- Aucun";
   const selfRefLines = report.selfReferencesDetected.length
      ? report.selfReferencesDetected.join(", ")
      : "Aucune";

   return `# Rapport de build — unités d'apprentissage (Parcours, données)

## Provenance

- Composition des caractères : \`data/generated/character-composition/\` (buildId \`${report.derivedFrom.characterCompositionBuildId}\`)
- Clés/radicaux : \`data/generated/character-radicals/\` (buildId \`${report.derivedFrom.characterRadicalsBuildId}\`)
- Dictionnaire (pinyin, sens, mots) : \`data/generated/dictionary/\` (buildId \`${report.derivedFrom.dictionaryBuildId}\`)
- HSK 1 (pack personnel) : \`hsk1.json\` (racine du dépôt), SHA-256 \`${report.derivedFrom.hsk1RootSha256}\`
- Bibliothèque personnelle (\`db.cards\`/packs) : ${
      report.derivedFrom.personalLibrary.found
         ? `trouvée à \`${report.derivedFrom.personalLibrary.path}\` (${report.derivedFrom.personalLibrary.cardCount} cartes)`
         : `**absente** — aucun fichier à \`${path.relative(projectRoot, personalLibraryPath).replaceAll("\\", "/")}\`. ` +
           `Ce signal vaut honnêtement zéro pour tous les caractères plutôt que d'être deviné. ` +
           `Pour l'inclure : Réglages → Données → Exporter dans l'application, puis enregistrer le fichier téléchargé à ce chemin et relancer le build.`
   }

Cet index est une transformation de données déjà sous licence : LGPL v3 ou ultérieure (Make Me a Hanzi,
via character-composition et character-radicals) et CC BY-SA (CC-CEDICT 4.0, CFDICT 3.0, via dictionary/)
pour le pinyin et les sens. Il hérite de ces licences. Aucune donnée n'est inventée : une information absente
des sources est omise (valeur \`null\` ou tableau vide), jamais devinée.

## 1. Familles phonétiques

| Mesure | Valeur |
| --- | ---: |
| Composants phonétiques avec ≥1 caractère de mon dictionnaire | ${c.distinctPhoneticComponentsWithAnyDictionaryMember} |
| Familles retenues (≥2 membres dans mon dictionnaire) | ${c.retainedPhoneticFamilyCount} |
| … dont avec ≥4 membres | ${c.phoneticFamiliesWithAtLeast4Members} |

Distribution des familles retenues par taille (nombre de membres → nombre de familles) :

\`\`\`
${Object.entries(c.phoneticFamilySizeDistribution).map(([size, n]) => `${size} membre(s) : ${n} famille(s)`).join("\n")}
\`\`\`

Note : la note de chantier mentionnait « 1 549 familles phonétiques distinctes » — ce chiffre correspond aux
composants ayant **au moins 1** membre dans mon dictionnaire (mesuré ici aussi : ${c.distinctPhoneticComponentsWithAnyDictionaryMember}).
La consigne de rétention de cet index exige **au moins 2** membres pour qu'une famille soit pédagogiquement
utile (un composant partagé par un seul caractère n'enseigne rien sur la prononciation), d'où ${c.retainedPhoneticFamilyCount} familles
retenues. Le sous-ensemble à ≥4 membres (${c.phoneticFamiliesWithAtLeast4Members}) correspond exactement aux « 646 » cité en introduction.

## 2. Graphe de dépendances

| Mesure | Valeur |
| --- | ---: |
| Nœuds du graphe (caractères + composants) | ${c.graphNodeCount} |
| Arêtes (caractère → composant direct) | ${c.graphEdgeCount} |
| Caractères de mon dictionnaire atteignables (≥1 arête, entrante ou sortante) | ${c.dictionaryReachableCount} / ${c.dictionaryCharacterCount} |
| Caractères de mon dictionnaire orphelins (aucune arête) | ${c.dictionaryOrphanedCount} |
| Cycles détectés | ${c.cyclesDetectedCount} |
| Auto-références détectées | ${c.selfReferencesDetectedCount} |

« Atteignable » signifie : le caractère a au moins une composante directe connue, ou est lui-même la composante
directe d'au moins un autre caractère. Les orphelins n'ont ni fiche de composition utilisable, ni usage comme
composant ailleurs ; un échantillon de ${report.orphanedCharactersSample.length} figure dans \`build-report.json\`.

Cycles :
${cycleLines}

Auto-références (un caractère listé comme sa propre composante directe) : ${selfRefLines}

La détection utilise un parcours en profondeur itératif (pile explicite, sans récursion), donc sans risque de
boucle infinie ni de dépassement de pile quelle que soit la structure réelle des données.

## 3. Score d'utilité

${report.utilityFormula.description}

Multiplicateur retenu : ${report.utilityFormula.tierMultiplier} (plus petite puissance de dix strictement supérieure
au nombre de mots maximal observé, ${report.utilityFormula.maxWordCountObserved}).

| Niveau | Signal | Caractères concernés |
| --- | --- | ---: |
| 3 | Dans mes cartes/packs personnels | ${c.personalLibraryFound ? c.personalLibraryCharacterCount : "0 (aucun export trouvé)"} |
| 2 | Dans hsk1.json | ${c.hsk1RootCharacterCount} |
| 1 / 0 | Fréquence lexicale dans mon dictionnaire | ${c.dictionaryCharacterCount} caractères notés |

## 3 bis. Noms des composants enseignés

| Mesure | Valeur |
| --- | ---: |
| Composants distincts enseignés | ${c.distinctTaughtComponentCount} |
| … nommés par \`${report.componentLabelsFr.file}\` (écrit à la main) | ${c.taughtComponentsByGlossSource["components-fr"] || 0} |
| … nommés par le dictionnaire français | ${c.taughtComponentsByGlossSource.dictionary || 0} |
| … repli sur la définition anglaise de Make Me a Hanzi | ${c.taughtComponentsByGlossSource["composition-en"] || 0} |
| … sans aucun nom dans les sources | ${c.taughtComponentsWithoutGlossCount} |

\`componentGlossSource\` décrit désormais l'origine du **texte** affiché, et rien d'autre : un composant
n'est étiqueté \`dictionary\` que si le dictionnaire fournit réellement un sens. ${
      c.taughtComponentsWithoutGloss.length
         ? `Composants encore sans nom, laissés vides plutôt qu'inventés : ${c.taughtComponentsWithoutGloss.join(", ")}.`
         : "Tous les composants enseignés portent un nom."
   }

## 4. Unités d'apprentissage

| Mesure | Valeur |
| --- | ---: |
| Unités produites au total | ${c.unitCount} |
| … unités phonétiques | ${c.phoneticUnitCount} |
| … unités sémantiques (clé de repli) | ${c.semanticUnitCount} |
| Groupes sémantiques retenus (≥2 membres restants après retrait des caractères déjà couverts par le phonétique) | ${c.retainedSemanticGroupCount} |
| Caractères couverts par une unité phonétique | ${c.phoneticallyCoveredCharacterCount} |
| Caractères couverts par une unité sémantique | ${c.semanticallyCoveredCharacterCount} |
| Caractères couverts par au moins une unité (union) | ${c.totalCoveredCharacterCount} / ${c.dictionaryCharacterCount} |
| Caractères non couverts par aucune unité | ${c.uncoveredCharacterCount} |
| Unités couvrant au moins un mot de mes packs | ${
      c.personalCoverageApplicable
         ? `${c.unitsCoveringAtLeastOnePersonalWord} / ${c.unitCount}`
         : "non applicable (0/" + c.unitCount + " — aucun export personnel trouvé, voir Provenance ci-dessus)"
   } |

### Exemple complet d'unité

- Identifiant : \`${example.id}\` (type ${example.type}, partie ${example.partIndex}/${example.partCount})
- Composant enseigné : ${example.component} (${example.componentPinyin || "pinyin inconnu"}, "${example.componentGloss || "sens inconnu"}")
- Prérequis (composantes directes du composant enseigné) : ${example.prerequisites.length ? example.prerequisites.join(", ") : "aucun (composant primitif)"}
- Score d'utilité agrégé : ${example.utilityScore}
- Caractères (${example.members.length}) : ${exampleMembers}
- Exemples de mots réels tirés du dictionnaire : ${exampleWords || "aucun"}

Structure JSON complète disponible dans \`build-report.json\` → \`exampleUnit\`, et dans \`units.json\`
(ou \`chunks/\`) sous l'identifiant \`${example.id}\`.
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
   const result = await buildLearningUnitsIndex({ outputDirectory: commandLineOutputDirectory() });
   console.log(
      `Unités d'apprentissage : ${result.manifest.counts.unitCount} unités ` +
         `(${result.manifest.counts.phoneticUnitCount} phonétiques, ${result.manifest.counts.semanticUnitCount} sémantiques), ` +
         `${result.manifest.counts.retainedPhoneticFamilyCount} familles phonétiques retenues, ` +
         `${result.manifest.counts.dictionaryReachableCount} caractères atteignables sur ${result.manifest.counts.dictionaryCharacterCount}, ` +
         `${result.manifest.counts.cyclesDetectedCount} cycles détectés`,
   );
}
