import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCharacterRadicals } from "./build-character-radicals.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(projectRoot, "data", "generated", "character-radicals");
const compositionDirectory = path.join(projectRoot, "data", "generated", "character-composition");
const dictionaryDirectory = path.join(projectRoot, "data", "generated", "dictionary");

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
   const report = JSON.parse(await readFile(path.join(generatedDirectory, "build-report.json"), "utf8"));
   if (manifest.format !== "mo-studio-character-radicals" || manifest.schemaVersion !== 1)
      throw new Error("Format ou version de schéma de manifeste invalide");
   if (!Array.isArray(manifest.radicals) || !manifest.radicals.length)
      throw new Error("Le manifeste ne contient aucune clé");

   const seenRadicals = new Set();
   let previousSortKey = null;
   for (const row of manifest.radicals) {
      if (seenRadicals.has(row.radical)) throw new Error(`Clé dupliquée dans le manifeste : ${row.radical}`);
      seenRadicals.add(row.radical);
      if (!(row.memberCount > 0)) throw new Error(`Clé sans membre dans le manifeste : ${row.radical}`);
      if (row.strokeCount != null && !(Number.isInteger(row.strokeCount) && row.strokeCount > 0))
         throw new Error(`Nombre de traits invalide pour la clé ${row.radical}`);

      const sortKey = [row.strokeCount == null ? Infinity : row.strokeCount, row.radical.codePointAt(0)];
      if (previousSortKey) {
         const inOrder =
            sortKey[0] > previousSortKey[0] ||
            (sortKey[0] === previousSortKey[0] && sortKey[1] >= previousSortKey[1]);
         if (!inOrder) throw new Error(`Ordre du manifeste incorrect autour de la clé ${row.radical}`);
      }
      previousSortKey = sortKey;

      const buffer = await readFile(path.join(generatedDirectory, row.path));
      if (buffer.length !== row.bytes || sha256(buffer) !== row.sha256)
         throw new Error(`Empreinte de chunk invalide : ${row.path}`);
      const chunk = JSON.parse(buffer.toString("utf8"));
      if (chunk.radical !== row.radical) throw new Error(`Radical incohérent dans ${row.path}`);
      if (!Array.isArray(chunk.characters) || chunk.characters.length !== row.memberCount)
         throw new Error(`Nombre de membres incohérent pour ${row.radical}`);

      let previousMemberKey = null;
      const seenMembers = new Set();
      for (const member of chunk.characters) {
         if (seenMembers.has(member.hanzi)) throw new Error(`Caractère dupliqué dans ${row.path} : ${member.hanzi}`);
         seenMembers.add(member.hanzi);
         if (member.strokeCount != null && !(Number.isInteger(member.strokeCount) && member.strokeCount > 0))
            throw new Error(`Nombre de traits de membre invalide pour ${member.hanzi}`);
         const memberKey = [
            member.strokeCount == null ? Infinity : member.strokeCount,
            member.hanzi.codePointAt(0),
         ];
         if (previousMemberKey) {
            const inOrder =
               memberKey[0] > previousMemberKey[0] ||
               (memberKey[0] === previousMemberKey[0] && memberKey[1] >= previousMemberKey[1]);
            if (!inOrder) throw new Error(`Ordre des membres incorrect dans ${row.path} autour de ${member.hanzi}`);
         }
         previousMemberKey = memberKey;
      }
   }

   const declaredSum = manifest.radicals.reduce((total, row) => total + row.memberCount, 0);
   if (declaredSum !== manifest.counts.charactersCovered)
      throw new Error("La somme des membres déclarés ne correspond pas à charactersCovered");
   if (manifest.radicals.length !== manifest.counts.radicalsWithDictionaryMembers)
      throw new Error("Le nombre de clés du manifeste ne correspond pas à radicalsWithDictionaryMembers");

   const allFrench = report.frenchAttachment?.allDictionaryCharacters;
   const navigationFrench = report.frenchAttachment?.radicalNavigationCharacters;
   if (!allFrench || !navigationFrench)
      throw new Error("Les métriques françaises séparées dictionnaire/navigation sont absentes");
   if (allFrench.total !== manifest.counts.dictionaryCharactersTotal)
      throw new Error("Le total français du dictionnaire ne correspond pas au manifeste");
   if (navigationFrench.total !== manifest.counts.charactersCovered)
      throw new Error("Le total français de la navigation ne correspond pas au manifeste");
   if (
      navigationFrench.withFrenchBefore +
         navigationFrench.recoveredByExplicitSimplifiedTraditionalAttachment !==
      navigationFrench.withFrenchAfter
   ) throw new Error("Les récupérations françaises de la navigation ne s'équilibrent pas");
   if (navigationFrench.withFrenchAfter + navigationFrench.remainingWithoutFrench !== navigationFrench.total)
      throw new Error("Le reste sans français de la navigation ne s'équilibre pas");
   if (
      report.frenchAttachment.recoveredCharacters.length !==
      navigationFrench.recoveredByExplicitSimplifiedTraditionalAttachment
   ) throw new Error("La liste des caractères français récupérés dans les clés est incohérente");
   if (
      report.frenchAttachment.manyToOneCollisions.length !==
      navigationFrench.manyToOneCollisionCharacters
   ) throw new Error("La liste des collisions plusieurs-vers-un dans les clés est incohérente");

   const compositionManifest = JSON.parse(
      await readFile(path.join(compositionDirectory, "manifest.json"), "utf8"),
   );
   const dictionaryManifest = JSON.parse(
      await readFile(path.join(dictionaryDirectory, "manifest.json"), "utf8"),
   );
   if (manifest.derivedFrom.characterCompositionBuildId !== compositionManifest.buildId)
      throw new Error(
         "character-composition a été reconstruit depuis : reconstruire character-radicals (buildId différent)",
      );
   if (manifest.derivedFrom.dictionaryBuildId !== dictionaryManifest.buildId)
      throw new Error("dictionary a été reconstruit depuis : reconstruire character-radicals (buildId différent)");

   return manifest;
}

async function validateDeterministicRebuild() {
   const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mo-radicals-"));
   const rebuiltDirectory = path.join(temporaryRoot, "character-radicals");
   try {
      await buildCharacterRadicals({ outputDirectory: rebuiltDirectory });
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
         if (!expected.equals(actual)) throw new Error(`Reconstruction non déterministe : ${filename}`);
      }
   } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
   }
}

const manifest = await validateDeclaredHashes();
await validateDeterministicRebuild();
console.log(
   `PASS radicaux ${manifest.counts.radicalsWithDictionaryMembers} clés, ` +
      `${manifest.counts.charactersCovered} caractères couverts, ` +
      `${manifest.counts.dictionaryCharactersWithoutRadical} sans clé connue`,
);
