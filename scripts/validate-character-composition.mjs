import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
   buildCharacterComposition,
   compactIdsTree,
   compositionChunkKey,
   parseIds,
} from "./build-character-composition.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(
   projectRoot,
   "data",
   "generated",
   "character-composition",
);

function sha256(value) {
   return createHash("sha256").update(value).digest("hex");
}

async function filesBelow(directory, relative = "") {
   const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
   const output = [];
   for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) output.push(...(await filesBelow(directory, child)));
      else if (entry.isFile()) output.push(child.replaceAll("\\", "/"));
   }
   return output;
}

async function validateDeclaredHashes() {
   const manifest = JSON.parse(await readFile(path.join(generatedDirectory, "manifest.json"), "utf8"));
   const indexBuffer = await readFile(
      path.join(generatedDirectory, manifest.characterIndex.path),
   );
   if (indexBuffer.length !== manifest.characterIndex.bytes || sha256(indexBuffer) !== manifest.characterIndex.sha256)
      throw new Error("Empreinte de character-index.json invalide");
   const characterIndex = JSON.parse(indexBuffer.toString("utf8"));
   if (Object.keys(characterIndex).length !== manifest.characterIndex.count)
      throw new Error("Nombre d’entrées de character-index.json invalide");

   const seen = new Set();
   for (const chunk of manifest.chunks) {
      const buffer = await readFile(path.join(generatedDirectory, chunk.path));
      if (buffer.length !== chunk.bytes || sha256(buffer) !== chunk.sha256)
         throw new Error(`Empreinte de chunk invalide : ${chunk.path}`);
      const records = JSON.parse(buffer.toString("utf8"));
      if (Object.keys(records).length !== chunk.count)
         throw new Error(`Nombre d’entrées invalide : ${chunk.path}`);
      for (const [character, record] of Object.entries(records)) {
         if (seen.has(character)) throw new Error(`Caractère généré dupliqué : ${character}`);
         seen.add(character);
         if (compositionChunkKey(character) !== chunk.key)
            throw new Error(`Mauvais chunk pour ${character}`);
         if (record.character !== character || characterIndex[character]?.chunk !== chunk.key)
            throw new Error(`Index de caractère incohérent pour ${character}`);
         const expectedTree = compactIdsTree(parseIds(record.decomposition));
         if (JSON.stringify(record.tree) !== JSON.stringify(expectedTree))
            throw new Error(`Arbre IDS généré incohérent pour ${character}`);
         if (
            record.etymology?.type === "pictophonetic" &&
            !["semantic", "phonetic", "hint"].every((key) =>
               record.etymology[key] == null || typeof record.etymology[key] === "string",
            )
         ) throw new Error(`Étymologie pictophonétique invalide pour ${character}`);
      }
   }
   if (seen.size !== manifest.characterIndex.count)
      throw new Error("Couverture des chunks différente de l’index");
   for (const licenseFile of manifest.licenseFiles) {
      const buffer = await readFile(path.join(generatedDirectory, licenseFile.path));
      if (buffer.length !== licenseFile.bytes || sha256(buffer) !== licenseFile.sha256)
         throw new Error(`Copie de licence invalide : ${licenseFile.path}`);
   }
   return manifest;
}

async function validateDeterministicRebuild() {
   const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mo-composition-"));
   const rebuiltDirectory = path.join(temporaryRoot, "character-composition");
   try {
      await buildCharacterComposition({ outputDirectory: rebuiltDirectory });
      const [expectedFiles, actualFiles] = await Promise.all([
         filesBelow(generatedDirectory),
         filesBelow(rebuiltDirectory),
      ]);
      if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles))
         throw new Error("La liste des fichiers diffère après reconstruction");
      for (const filename of expectedFiles) {
         const [expected, actual] = await Promise.all([
            readFile(path.join(generatedDirectory, filename)),
            readFile(path.join(rebuiltDirectory, filename)),
         ]);
         if (!expected.equals(actual))
            throw new Error(`Reconstruction non déterministe : ${filename}`);
      }
   } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
   }
}

const manifest = await validateDeclaredHashes();
await validateDeterministicRebuild();
console.log(
   `PASS composition ${manifest.coverage.dictionaryWithUsableCompositionCount} utilisables, ` +
      `${manifest.coverage.dictionaryWithPictophoneticCompositionCount} pictophonétiques`,
);
