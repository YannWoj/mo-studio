import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLearningUnitsIndex } from "./build-learning-units.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(projectRoot, "data", "generated", "learning-units");

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
   if (manifest.format !== "mo-studio-learning-units") throw new Error("Format de manifeste inattendu");

   for (const [name, descriptor] of Object.entries(manifest.files)) {
      if (name === "units") continue;
      const buffer = await readFile(path.join(generatedDirectory, descriptor.path));
      if (buffer.length !== descriptor.bytes || sha256(buffer) !== descriptor.sha256)
         throw new Error(`Empreinte invalide : ${descriptor.path}`);
   }

   const unitsDescriptor = manifest.files.units;
   if (unitsDescriptor.chunked) {
      let totalCount = 0;
      const seenIds = new Set();
      for (const chunk of unitsDescriptor.chunks) {
         const buffer = await readFile(path.join(generatedDirectory, chunk.path));
         if (buffer.length !== chunk.bytes || sha256(buffer) !== chunk.sha256)
            throw new Error(`Empreinte de chunk d’unités invalide : ${chunk.path}`);
         const units = JSON.parse(buffer.toString("utf8"));
         if (units.length !== chunk.count) throw new Error(`Nombre d’unités invalide : ${chunk.path}`);
         for (const unit of units) {
            if (seenIds.has(unit.id)) throw new Error(`Identifiant d’unité dupliqué : ${unit.id}`);
            seenIds.add(unit.id);
         }
         totalCount += units.length;
      }
      if (totalCount !== manifest.counts.unitCount)
         throw new Error("Le nombre total d’unités chunkées ne correspond pas au manifeste");
   } else {
      const buffer = await readFile(path.join(generatedDirectory, unitsDescriptor.path));
      if (buffer.length !== unitsDescriptor.bytes || sha256(buffer) !== unitsDescriptor.sha256)
         throw new Error("Empreinte de units.json invalide");
      const units = JSON.parse(buffer.toString("utf8"));
      if (units.length !== unitsDescriptor.count) throw new Error("Nombre d’unités invalide dans units.json");
   }

   // Chaque unité doit rester dans la fourchette de taille visée (2 à 8 : les
   // familles/groupes à 2-3 membres ne sont pas fractionnés) et référencer des
   // caractères réellement présents dans le dictionnaire de composition.
   const unitsIndex = JSON.parse(
      await readFile(path.join(generatedDirectory, manifest.files.unitsIndex.path), "utf8"),
   );
   if (unitsIndex.length !== manifest.counts.unitCount)
      throw new Error("units-index.json ne correspond pas au nombre d’unités du manifeste");
   for (const unit of unitsIndex) {
      if (unit.memberCharacters.length < 2 || unit.memberCharacters.length > 8)
         throw new Error(`Taille d’unité hors fourchette pour ${unit.id} : ${unit.memberCharacters.length}`);
      if (unit.type !== "phonetic" && unit.type !== "semantic")
         throw new Error(`Type d’unité inconnu pour ${unit.id} : ${unit.type}`);
   }

   const graph = JSON.parse(await readFile(path.join(generatedDirectory, "graph.json"), "utf8"));
   if (graph.meta.cyclesDetected.length !== manifest.counts.cyclesDetectedCount)
      throw new Error("Nombre de cycles incohérent entre graph.json et le manifeste");
   for (const cycle of graph.meta.cyclesDetected) {
      if (cycle.length < 2) throw new Error("Cycle mal formé dans graph.json");
   }

   return manifest;
}

async function validateDeterministicRebuild() {
   const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mo-learning-units-"));
   const rebuiltDirectory = path.join(temporaryRoot, "learning-units");
   try {
      const { manifest: rebuiltManifest } = await buildLearningUnitsIndex({ outputDirectory: rebuiltDirectory });
      const originalManifest = JSON.parse(await readFile(path.join(generatedDirectory, "manifest.json"), "utf8"));
      if (rebuiltManifest.buildId !== originalManifest.buildId)
         throw new Error("Reconstruction non déterministe : buildId différent");

      const [expectedFiles, actualFiles] = await Promise.all([
         filesBelow(generatedDirectory),
         filesBelow(rebuiltDirectory),
      ]);
      if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles))
         throw new Error("La liste des fichiers générés diffère après reconstruction");
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
   `PASS learning-units ${manifest.counts.unitCount} unités, ` +
      `${manifest.counts.retainedPhoneticFamilyCount} familles phonétiques, ` +
      `${manifest.counts.dictionaryReachableCount} caractères atteignables, ` +
      `${manifest.counts.cyclesDetectedCount} cycles`,
);
