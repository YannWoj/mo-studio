import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

export const RADICALS_BUILDER_VERSION = "1.0.0";
export const HANZI_WRITER_VERSION = "2.0.1";

const defaultCompositionDirectory = path.join(
   projectRoot,
   "data",
   "generated",
   "character-composition",
);
const defaultDictionaryDirectory = path.join(projectRoot, "data", "generated", "dictionary");
const defaultHanziWriterDirectory = path.join(
   projectRoot,
   "data",
   "generated",
   "hanzi-writer",
   HANZI_WRITER_VERSION,
);
const defaultOutputDirectory = path.join(projectRoot, "data", "generated", "character-radicals");

function sha256(value) {
   return createHash("sha256").update(value).digest("hex");
}

function compareCharacters(left, right) {
   const leftCodepoint = left.codePointAt(0) || 0;
   const rightCodepoint = right.codePointAt(0) || 0;
   return leftCodepoint - rightCodepoint || left.localeCompare(right, "zh");
}

function compareRadicalRows(left, right) {
   const leftStroke = left.strokeCount == null ? Infinity : left.strokeCount;
   const rightStroke = right.strokeCount == null ? Infinity : right.strokeCount;
   return leftStroke - rightStroke || compareCharacters(left.radical, right.radical);
}

function readStrokeCount(hanziWriterDirectory, character) {
   try {
      const raw = readFileSync(path.join(hanziWriterDirectory, `${character}.json`), "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data.strokes) && data.strokes.length ? data.strokes.length : null;
   } catch (error) {
      return null;
   }
}

async function writeJson(filename, value, pretty = false) {
   const content = `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
   await writeFile(filename, content, "utf8");
   return Buffer.from(content, "utf8");
}

export async function buildCharacterRadicals(options = {}) {
   const compositionDirectory = path.resolve(
      options.compositionDirectory || defaultCompositionDirectory,
   );
   const dictionaryDirectory = path.resolve(options.dictionaryDirectory || defaultDictionaryDirectory);
   const hanziWriterDirectory = path.resolve(
      options.hanziWriterDirectory || defaultHanziWriterDirectory,
   );
   const outputDirectory = path.resolve(options.outputDirectory || defaultOutputDirectory);

   const compositionManifest = JSON.parse(
      await readFile(path.join(compositionDirectory, "manifest.json"), "utf8"),
   );
   const dictionaryManifest = JSON.parse(
      await readFile(path.join(dictionaryDirectory, "manifest.json"), "utf8"),
   );
   const characterIndex = JSON.parse(
      await readFile(path.join(dictionaryDirectory, "character-index.json"), "utf8"),
   );
   const searchPreviews = JSON.parse(
      await readFile(path.join(dictionaryDirectory, "search-previews.json"), "utf8"),
   );
   const dictionaryCharacters = new Set(Object.keys(characterIndex));

   const chunkDirectory = path.join(compositionDirectory, "chunks");
   const chunkFiles = (await readdir(chunkDirectory)).filter((name) => name.endsWith(".json"));
   const radicalToCharacters = new Map();
   let sourceCharacterCount = 0;
   for (const filename of chunkFiles.sort()) {
      const records = JSON.parse(await readFile(path.join(chunkDirectory, filename), "utf8"));
      for (const [character, record] of Object.entries(records)) {
         sourceCharacterCount++;
         const radical = record.radical;
         if (!radical || Array.from(radical).length !== 1) {
            throw new Error(`Clé invalide pour ${character} : ${JSON.stringify(radical)}`);
         }
         if (!radicalToCharacters.has(radical)) radicalToCharacters.set(radical, []);
         radicalToCharacters.get(radical).push(character);
      }
   }
   const radicalsInSourceCount = radicalToCharacters.size;

   function glossFor(radicalCharacter) {
      const indexed = characterIndex[radicalCharacter];
      if (!indexed) return null;
      const preview = searchPreviews.entries[indexed.entryRef];
      if (!Array.isArray(preview)) return null;
      return preview[5] || null;
   }

   const coveredCharacters = new Set();
   const excludedRadicals = [];
   const radicalRows = [];
   const chunkContents = new Map();

   for (const [radical, characters] of radicalToCharacters.entries()) {
      const members = characters.filter((character) => dictionaryCharacters.has(character));
      if (!members.length) {
         excludedRadicals.push(radical);
         continue;
      }
      members.forEach((character) => coveredCharacters.add(character));
      const memberRows = members
         .map((hanzi) => ({ hanzi, strokeCount: readStrokeCount(hanziWriterDirectory, hanzi) }))
         .sort((left, right) => {
            const leftStroke = left.strokeCount == null ? Infinity : left.strokeCount;
            const rightStroke = right.strokeCount == null ? Infinity : right.strokeCount;
            return leftStroke - rightStroke || compareCharacters(left.hanzi, right.hanzi);
         });
      chunkContents.set(radical, { radical, characters: memberRows });
      radicalRows.push({
         radical,
         strokeCount: readStrokeCount(hanziWriterDirectory, radical),
         sens: glossFor(radical),
         memberCount: memberRows.length,
      });
   }
   radicalRows.sort(compareRadicalRows);

   await rm(outputDirectory, { recursive: true, force: true });
   const outputChunkDirectory = path.join(outputDirectory, "chunks");
   await mkdir(outputChunkDirectory, { recursive: true });

   const chunkDescriptors = [];
   for (const row of radicalRows) {
      const filename = path.join(outputChunkDirectory, `${row.radical}.json`);
      const content = await writeJson(filename, chunkContents.get(row.radical));
      chunkDescriptors.push({
         radical: row.radical,
         strokeCount: row.strokeCount,
         sens: row.sens,
         memberCount: row.memberCount,
         path: `chunks/${row.radical}.json`,
         bytes: content.length,
         sha256: sha256(content),
      });
   }

   const dictionaryCharactersTotal = dictionaryCharacters.size;
   const charactersCovered = coveredCharacters.size;
   const counts = {
      radicalsInSource: radicalsInSourceCount,
      radicalsWithDictionaryMembers: chunkDescriptors.length,
      charactersCovered,
      dictionaryCharactersTotal,
      dictionaryCharactersWithoutRadical: dictionaryCharactersTotal - charactersCovered,
   };

   const oneMemberRadicals = chunkDescriptors.filter((row) => row.memberCount === 1).map((row) => row.radical);
   const missingStrokeRadicals = chunkDescriptors.filter((row) => row.strokeCount == null).map((row) => row.radical);

   const testCases = [
      { criterion: "large-group", radical: "氵", memberCountAtLeast: 400 },
      { criterion: "self-radical", radical: "木", memberOfOwnGroup: dictionaryCharacters.has("木") },
      {
         criterion: "single-member",
         radical: oneMemberRadicals[0] || null,
         memberCount: 1,
      },
      { criterion: "excluded-zero-member", radical: excludedRadicals[0] || null },
      { criterion: "gloss-present", radical: "木", sens: glossFor("木") },
   ];

   const report = {
      format: "mo-studio-character-radicals-build-report",
      builderVersion: RADICALS_BUILDER_VERSION,
      derivedFrom: {
         characterCompositionBuildId: compositionManifest.buildId,
         dictionaryBuildId: dictionaryManifest.buildId,
         hanziWriterVersion: HANZI_WRITER_VERSION,
      },
      coverage: {
         ...counts,
         radicalsExcludedZeroMembers: excludedRadicals.length,
         excludedRadicals,
         radicalsWithoutStrokeCount: missingStrokeRadicals.length,
         missingStrokeRadicals,
         radicalsWithGloss: chunkDescriptors.filter((row) => row.sens).length,
         radicalsWithoutGloss: chunkDescriptors.filter((row) => !row.sens).length,
         oneOrTwoMemberRadicals: chunkDescriptors.filter((row) => row.memberCount <= 2).length,
      },
      testCases,
   };
   await writeJson(path.join(outputDirectory, "build-report.json"), report, true);

   const reportMarkdown = `# Character radicals build report

- Derived from: \`character-composition\` (buildId \`${compositionManifest.buildId}\`) and \`dictionary\` (buildId \`${dictionaryManifest.buildId}\`)
- Stroke counts from: \`hanzi-writer\` ${HANZI_WRITER_VERSION}

| Measurement | Value |
| --- | ---: |
| Distinct radicals found in the composition data | ${counts.radicalsInSource} |
| Radicals with >=1 dictionary-linked character (shown in the picker) | ${counts.radicalsWithDictionaryMembers} |
| Radicals excluded (zero dictionary-linked members) | ${excludedRadicals.length} (${excludedRadicals.join(", ") || "—"}) |
| Dictionary characters covered by a known radical | ${counts.charactersCovered} |
| Dictionary characters total | ${counts.dictionaryCharactersTotal} |
| Dictionary characters without a known radical | ${counts.dictionaryCharactersWithoutRadical} |
| Radicals with only 1-2 dictionary members | ${report.coverage.oneOrTwoMemberRadicals} |
| Radicals with a short French gloss | ${report.coverage.radicalsWithGloss} |
| Radicals without a gloss | ${report.coverage.radicalsWithoutGloss} |
| Radicals missing hanzi-writer stroke data | ${missingStrokeRadicals.length} (${missingStrokeRadicals.join(", ") || "—"}) |

Generated chunks are a re-derivation of already-generated, already-licensed data (\`character-composition\`, \`dictionary\`, \`hanzi-writer\`); no new upstream text is introduced.
`;
   await writeFile(path.join(outputDirectory, "build-report.md"), reportMarkdown, "utf8");

   const manifestSeed = JSON.stringify({
      builderVersion: RADICALS_BUILDER_VERSION,
      chunkDescriptors,
      compositionBuildId: compositionManifest.buildId,
      dictionaryBuildId: dictionaryManifest.buildId,
   });
   const manifest = {
      format: "mo-studio-character-radicals",
      schemaVersion: 1,
      builderVersion: RADICALS_BUILDER_VERSION,
      buildId: sha256(manifestSeed),
      license: "Derived from Make Me a Hanzi (GNU Lesser General Public License v3 or later) via data/generated/character-composition/",
      derivedFrom: {
         characterCompositionBuildId: compositionManifest.buildId,
         dictionaryBuildId: dictionaryManifest.buildId,
         hanziWriterVersion: HANZI_WRITER_VERSION,
      },
      chunkPathTemplate: "chunks/{radical}.json",
      counts,
      radicals: chunkDescriptors,
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
   const result = await buildCharacterRadicals({ outputDirectory: commandLineOutputDirectory() });
   console.log(
      `Radicaux : ${result.manifest.counts.radicalsWithDictionaryMembers} clés, ` +
         `${result.manifest.counts.charactersCovered} caractères couverts, ` +
         `${result.manifest.counts.dictionaryCharactersWithoutRadical} caractères sans clé connue`,
   );
}
