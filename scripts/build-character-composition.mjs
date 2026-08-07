import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

export const MAKE_ME_A_HANZI_REVISION = "bddc96d41bef78427ed0e034e9f7e31d71fd1b92";
export const MAKE_ME_A_HANZI_DICTIONARY_SHA256 =
   "744bb05d5b0742e9ee35c37791f94d56a173349b3367569e7ca11e510364d203";
export const COMPOSITION_BUILDER_VERSION = "1.0.0";
export const COMPOSITION_CHUNK_MODULO = 64;

const defaultSourceDirectory = path.join(projectRoot, "data", "source", "makemeahanzi");
const defaultOutputDirectory = path.join(
   projectRoot,
   "data",
   "generated",
   "character-composition",
);
const dictionaryCharacterIndexPath = path.join(
   projectRoot,
   "data",
   "generated",
   "dictionary",
   "character-index.json",
);

export const IDS_ARITIES = Object.freeze({
   "⿰": 2,
   "⿱": 2,
   "⿲": 3,
   "⿳": 3,
   "⿴": 2,
   "⿵": 2,
   "⿶": 2,
   "⿷": 2,
   "⿸": 2,
   "⿹": 2,
   "⿺": 2,
   "⿻": 2,
});

function sha256(value) {
   return createHash("sha256").update(value).digest("hex");
}

function cleanText(value) {
   if (typeof value !== "string") return null;
   const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
   return normalized || null;
}

function compareCharacters(left, right) {
   const leftCodepoint = left.codePointAt(0) || 0;
   const rightCodepoint = right.codePointAt(0) || 0;
   return leftCodepoint - rightCodepoint || left.localeCompare(right, "zh");
}

export function parseIds(value) {
   const decomposition = cleanText(value);
   if (!decomposition || decomposition.includes("？")) return null;
   const codepoints = Array.from(decomposition);
   let cursor = 0;

   function parseNode() {
      if (cursor >= codepoints.length) {
         throw new Error(`IDS tronqué : ${decomposition}`);
      }
      const token = codepoints[cursor++];
      const arity = IDS_ARITIES[token];
      if (!arity) {
         if (/\s/u.test(token)) throw new Error(`Feuille IDS invalide : ${decomposition}`);
         return Object.freeze({ character: token });
      }
      const children = [];
      for (let index = 0; index < arity; index++) children.push(parseNode());
      return Object.freeze({
         operator: token,
         children: Object.freeze(children),
      });
   }

   const tree = parseNode();
   if (cursor !== codepoints.length) {
      throw new Error(`IDS avec contenu excédentaire : ${decomposition}`);
   }
   return tree;
}

export function idsTreeLeaves(tree) {
   if (!tree) return [];
   if (tree.character) return [tree.character];
   return tree.children.flatMap(idsTreeLeaves);
}

export function compactIdsTree(tree) {
   if (tree.character) return { c: tree.character };
   return { o: tree.operator, c: tree.children.map(compactIdsTree) };
}

export function compositionChunkKey(character) {
   const value = Array.from(String(character || "").normalize("NFC"));
   if (value.length !== 1) throw new Error(`Caractère de composition invalide : ${character}`);
   return ((value[0].codePointAt(0) || 0) % COMPOSITION_CHUNK_MODULO)
      .toString(16)
      .padStart(2, "0");
}

function shortDefinition(value) {
   const definition = cleanText(value);
   if (!definition) return null;
   return definition.split(/[;,]/u, 1)[0].trim() || null;
}

function normalizedEtymology(value) {
   if (!value || typeof value !== "object" || !cleanText(value.type)) return null;
   return {
      type: cleanText(value.type),
      semantic: cleanText(value.semantic),
      phonetic: cleanText(value.phonetic),
      hint: cleanText(value.hint),
   };
}

function sourceTestCases(sourceByCharacter, sourceEntries, dictionaryCharacters) {
   const sourceCase = (character, criterion) => {
      const entry = sourceByCharacter.get(character);
      if (!entry) throw new Error(`Cas témoin absent de la source : ${character}`);
      return { criterion, character, sourceLine: entry.sourceLine };
   };
   const absentFromSource = Array.from(dictionaryCharacters).find(
      (character) => character === "鶥" && !sourceByCharacter.has(character),
   ) || Array.from(dictionaryCharacters).find((character) => !sourceByCharacter.has(character));
   if (!absentFromSource) throw new Error("Aucun caractère du dictionnaire absent de Make Me a Hanzi");

   return [
      sourceCase("妈", "pictophonetic-complete"),
      sourceCase("你", "ideographic"),
      sourceCase("微", "without-etymology"),
      sourceCase("价", "pictophonetic-without-hint"),
      sourceCase("森", "nested-ids"),
      sourceCase("班", "ternary-left-middle-right"),
      sourceCase("京", "ternary-top-middle-bottom"),
      sourceCase("一", "invalid-full-width-question-mark"),
      {
         criterion: "dictionary-character-absent-from-source",
         character: absentFromSource,
         sourceLine: null,
      },
      sourceCase("学", "component-without-gloss"),
   ];
}

function validateTestCases(cases, sourceByCharacter) {
   const byCriterion = new Map(cases.map((item) => [item.criterion, item]));
   const entry = (criterion) => sourceByCharacter.get(byCriterion.get(criterion).character);
   const complete = entry("pictophonetic-complete");
   if (
      complete.etymology?.type !== "pictophonetic" ||
      !cleanText(complete.etymology.semantic) ||
      !cleanText(complete.etymology.phonetic) ||
      !cleanText(complete.etymology.hint)
   ) throw new Error("Le cas pictophonétique complet ne satisfait plus le critère");
   if (entry("ideographic").etymology?.type !== "ideographic")
      throw new Error("Le cas idéographique ne satisfait plus le critère");
   if (Object.hasOwn(entry("without-etymology"), "etymology"))
      throw new Error("Le cas sans étymologie possède désormais une étymologie");
   const withoutHint = entry("pictophonetic-without-hint");
   if (withoutHint.etymology?.type !== "pictophonetic" || cleanText(withoutHint.etymology.hint))
      throw new Error("Le cas pictophonétique sans hint ne satisfait plus le critère");
   if (!entry("nested-ids").decomposition.startsWith("⿱") || !/[⿰-⿻]/u.test(entry("nested-ids").decomposition.slice(1)))
      throw new Error("Le cas IDS imbriqué ne satisfait plus le critère");
   if (!entry("ternary-left-middle-right").decomposition.includes("⿲"))
      throw new Error("Le cas ⿲ ne satisfait plus le critère");
   if (!entry("ternary-top-middle-bottom").decomposition.includes("⿳"))
      throw new Error("Le cas ⿳ ne satisfait plus le critère");
   if (!entry("invalid-full-width-question-mark").decomposition.startsWith("？"))
      throw new Error("Le cas IDS invalide ne satisfait plus le critère");
}

async function writeJson(filename, value, pretty = false) {
   const content = `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
   await writeFile(filename, content, "utf8");
   return Buffer.from(content, "utf8");
}

async function fileMetadata(filename, relativePath) {
   const content = await readFile(filename);
   return {
      path: relativePath.replaceAll("\\", "/"),
      bytes: content.length,
      sha256: sha256(content),
   };
}

export async function buildCharacterComposition(options = {}) {
   const sourceDirectory = path.resolve(options.sourceDirectory || defaultSourceDirectory);
   const outputDirectory = path.resolve(options.outputDirectory || defaultOutputDirectory);
   const sourcePath = path.join(sourceDirectory, "dictionary.txt");
   const sourceBuffer = await readFile(sourcePath);
   const sourceHash = sha256(sourceBuffer);
   if (sourceHash !== MAKE_ME_A_HANZI_DICTIONARY_SHA256) {
      throw new Error(
         `dictionary.txt ne correspond pas à la révision épinglée : ${sourceHash}`,
      );
   }

   const rawLines = sourceBuffer.toString("utf8").split(/\r?\n/u);
   if (!rawLines.at(-1)) rawLines.pop();
   const sourceEntries = [];
   const sourceByCharacter = new Map();
   for (let index = 0; index < rawLines.length; index++) {
      let raw;
      try {
         raw = JSON.parse(rawLines[index]);
      } catch (error) {
         throw new Error(`JSON Make Me a Hanzi invalide à la ligne ${index + 1}`, {
            cause: error,
         });
      }
      const character = cleanText(raw.character);
      if (!character || Array.from(character).length !== 1)
         throw new Error(`Caractère invalide à la ligne ${index + 1}`);
      if (sourceByCharacter.has(character))
         throw new Error(`Caractère Make Me a Hanzi dupliqué : ${character}`);
      const entry = { ...raw, character, sourceLine: index + 1 };
      sourceEntries.push(entry);
      sourceByCharacter.set(character, entry);
   }

   const dictionaryCharacterIndex = JSON.parse(
      await readFile(dictionaryCharacterIndexPath, "utf8"),
   );
   const dictionaryCharacters = new Set(Object.keys(dictionaryCharacterIndex));
   const records = [];
   let unknownCompositionCount = 0;
   let pictophoneticSourceCount = 0;
   for (const entry of sourceEntries) {
      const etymology = normalizedEtymology(entry.etymology);
      if (etymology?.type === "pictophonetic") pictophoneticSourceCount++;
      const tree = parseIds(entry.decomposition);
      if (!tree) {
         unknownCompositionCount++;
         continue;
      }
      const componentCharacters = Array.from(new Set(idsTreeLeaves(tree)));
      const components = {};
      for (const character of componentCharacters.sort(compareCharacters)) {
         const component = sourceByCharacter.get(character);
         components[character] = {
            definition: shortDefinition(component?.definition),
            pinyin: Array.isArray(component?.pinyin)
               ? component.pinyin.map(cleanText).filter(Boolean)
               : [],
         };
      }
      records.push({
         character: entry.character,
         decomposition: cleanText(entry.decomposition),
         tree: compactIdsTree(tree),
         radical: cleanText(entry.radical),
         components,
         etymology,
         sourceLine: entry.sourceLine,
      });
   }

   const recordByCharacter = new Map(records.map((record) => [record.character, record]));
   const dictionaryWithComposition = Array.from(dictionaryCharacters).filter((character) =>
      recordByCharacter.has(character),
   );
   const dictionaryWithPictophonetic = dictionaryWithComposition.filter(
      (character) => recordByCharacter.get(character).etymology?.type === "pictophonetic",
   );
   const testCases = sourceTestCases(sourceByCharacter, sourceEntries, dictionaryCharacters);
   validateTestCases(testCases, sourceByCharacter);

   await rm(outputDirectory, { recursive: true, force: true });
   const chunkDirectory = path.join(outputDirectory, "chunks");
   await mkdir(chunkDirectory, { recursive: true });

   const chunks = new Map();
   const characterIndex = {};
   for (const record of records.sort((left, right) => compareCharacters(left.character, right.character))) {
      const key = compositionChunkKey(record.character);
      if (!chunks.has(key)) chunks.set(key, {});
      chunks.get(key)[record.character] = record;
      characterIndex[record.character] = { chunk: key, sourceLine: record.sourceLine };
   }

   const chunkMetadata = [];
   for (let index = 0; index < COMPOSITION_CHUNK_MODULO; index++) {
      const key = index.toString(16).padStart(2, "0");
      const relativePath = `chunks/${key}.json`;
      const filename = path.join(outputDirectory, relativePath);
      const content = await writeJson(filename, chunks.get(key) || {});
      chunkMetadata.push({
         key,
         path: relativePath,
         count: Object.keys(chunks.get(key) || {}).length,
         bytes: content.length,
         sha256: sha256(content),
      });
   }

   const indexBuffer = await writeJson(
      path.join(outputDirectory, "character-index.json"),
      characterIndex,
   );
   await copyFile(path.join(sourceDirectory, "LGPL"), path.join(outputDirectory, "LGPL"));
   await copyFile(path.join(sourceDirectory, "COPYING"), path.join(outputDirectory, "COPYING"));

   const report = {
      format: "mo-studio-character-composition-build-report",
      builderVersion: COMPOSITION_BUILDER_VERSION,
      source: {
         project: "Make Me a Hanzi",
         file: "data/source/makemeahanzi/dictionary.txt",
         revision: MAKE_ME_A_HANZI_REVISION,
         sha256: sourceHash,
         license: "GNU Lesser General Public License v3 or later",
         sourceEntryCount: sourceEntries.length,
      },
      coverage: {
         sourceUsableCompositionCount: records.length,
         sourceUnknownCompositionCount: unknownCompositionCount,
         sourcePictophoneticCount: pictophoneticSourceCount,
         dictionaryCharacterCount: dictionaryCharacters.size,
         dictionaryWithUsableCompositionCount: dictionaryWithComposition.length,
         dictionaryWithPictophoneticCompositionCount: dictionaryWithPictophonetic.length,
      },
      testCases,
   };
   await writeJson(path.join(outputDirectory, "build-report.json"), report, true);

   const reportMarkdown = `# Character composition build report

- Source: Make Me a Hanzi \`dictionary.txt\`
- Revision: \`${MAKE_ME_A_HANZI_REVISION}\`
- SHA-256: \`${sourceHash}\`
- License: GNU Lesser General Public License v3 or later

| Measurement | Value |
| --- | ---: |
| Source entries | ${sourceEntries.length} |
| Source entries with usable IDS | ${records.length} |
| Source pictophonetic entries | ${pictophoneticSourceCount} |
| Dictionary characters | ${dictionaryCharacters.size} |
| Dictionary characters with usable IDS | ${dictionaryWithComposition.length} |
| Dictionary characters with usable pictophonetic data | ${dictionaryWithPictophonetic.length} |

Generated indexes and chunks are transformations of \`dictionary.txt\` and remain subject to the LGPL v3 or later.
`;
   await writeFile(path.join(outputDirectory, "build-report.md"), reportMarkdown, "utf8");

   const licenseMetadata = await Promise.all([
      fileMetadata(path.join(outputDirectory, "LGPL"), "LGPL"),
      fileMetadata(path.join(outputDirectory, "COPYING"), "COPYING"),
   ]);
   const manifestSeed = JSON.stringify({
      sourceHash,
      builderVersion: COMPOSITION_BUILDER_VERSION,
      chunkMetadata,
      indexHash: sha256(indexBuffer),
   });
   const manifest = {
      format: "mo-studio-character-composition",
      schemaVersion: 1,
      builderVersion: COMPOSITION_BUILDER_VERSION,
      buildId: sha256(manifestSeed),
      sourceProject: "Make Me a Hanzi",
      sourceRevision: MAKE_ME_A_HANZI_REVISION,
      sourceSha256: sourceHash,
      license: "GNU Lesser General Public License v3 or later",
      chunkModulo: COMPOSITION_CHUNK_MODULO,
      chunkPathTemplate: "chunks/{chunk}.json",
      characterIndex: {
         path: "character-index.json",
         count: records.length,
         bytes: indexBuffer.length,
         sha256: sha256(indexBuffer),
      },
      chunks: chunkMetadata,
      licenseFiles: licenseMetadata,
      coverage: report.coverage,
   };
   await writeJson(path.join(outputDirectory, "manifest.json"), manifest, true);
   return { outputDirectory, manifest, report };
}

function commandLineOutputDirectory() {
   const outputIndex = process.argv.indexOf("--output");
   if (outputIndex < 0) return defaultOutputDirectory;
   if (!process.argv[outputIndex + 1]) throw new Error("--output exige un chemin");
   return path.resolve(projectRoot, process.argv[outputIndex + 1]);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
   const result = await buildCharacterComposition({
      outputDirectory: commandLineOutputDirectory(),
   });
   console.log(
      `Composition: ${result.report.coverage.dictionaryWithUsableCompositionCount} caractères du dictionnaire, ` +
         `${result.report.coverage.dictionaryWithPictophoneticCompositionCount} pictophonétiques`,
   );
}
