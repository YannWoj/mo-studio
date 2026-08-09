import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfusablePairsIndex, GEOMETRIC_ACTIVE_TIER_THRESHOLD } from "./build-confusable-pairs.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedDirectory = path.join(projectRoot, "data", "generated", "confusable-pairs");

const REQUIRED_VERIFICATION_PAIRS = [
   ["未", "末"],
   ["日", "曰"],
   ["己", "已"],
   ["土", "士"],
];

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

function pairKeyOf(a, b) {
   const left = a.codePointAt(0) || 0;
   const right = b.codePointAt(0) || 0;
   return left <= right ? `${a}|${b}` : `${b}|${a}`;
}

async function validateDeclaredHashes() {
   const manifest = JSON.parse(await readFile(path.join(generatedDirectory, "manifest.json"), "utf8"));
   if (manifest.format !== "mo-studio-confusable-pairs") throw new Error("Format de manifeste inattendu");

   const characterIndexBuffer = await readFile(path.join(generatedDirectory, manifest.characterIndex.path));
   if (characterIndexBuffer.length !== manifest.characterIndex.bytes || sha256(characterIndexBuffer) !== manifest.characterIndex.sha256)
      throw new Error("Empreinte invalide : character-index.json");

   const characterIndex = JSON.parse(characterIndexBuffer.toString("utf8"));
   const seenCharacters = new Set();
   for (const chunk of manifest.chunks) {
      const buffer = await readFile(path.join(generatedDirectory, chunk.path));
      if (buffer.length !== chunk.bytes || sha256(buffer) !== chunk.sha256)
         throw new Error(`Empreinte de chunk invalide : ${chunk.path}`);
      const parsed = JSON.parse(buffer.toString("utf8"));
      const characters = Object.keys(parsed);
      if (characters.length !== chunk.characterCount)
         throw new Error(`Nombre de caractères invalide dans ${chunk.path}`);
      for (const character of characters) {
         if (seenCharacters.has(character)) throw new Error(`Caractère dupliqué entre chunks : ${character}`);
         seenCharacters.add(character);
         if (!characterIndex[character]) throw new Error(`${character} présent dans un chunk mais absent de character-index.json`);
         if (characterIndex[character].chunk !== chunk.key)
            throw new Error(`character-index.json pointe ${character} vers le mauvais chunk`);
         const partners = parsed[character];
         if (!Array.isArray(partners) || !partners.length)
            throw new Error(`${character} n'a aucun partenaire alors qu'il figure dans l'index`);
         for (const partner of partners) {
            if (!characterIndex[partner.character])
               throw new Error(`${character} référence ${partner.character}, absent de character-index.json`);
            if (typeof partner.activeTier !== "boolean")
               throw new Error(`activeTier manquant ou invalide pour ${character} -> ${partner.character}`);
         }
      }
   }
   if (seenCharacters.size !== Object.keys(characterIndex).length)
      throw new Error("character-index.json et les chunks ne référencent pas exactement les mêmes caractères");

   // Symétrie : si A référence B, B doit référencer A avec le même statut structurel
   // et le même score géométrique (données construites symétriquement au build).
   const recordByCharacter = new Map();
   for (const chunk of manifest.chunks) {
      const parsed = JSON.parse(await readFile(path.join(generatedDirectory, chunk.path), "utf8"));
      for (const [character, partners] of Object.entries(parsed)) recordByCharacter.set(character, partners);
   }
   for (const [character, partners] of recordByCharacter) {
      for (const partner of partners) {
         const reverse = (recordByCharacter.get(partner.character) || []).find((entry) => entry.character === character);
         if (!reverse) throw new Error(`Paire non symétrique : ${character} -> ${partner.character} sans retour`);
         if (reverse.structural !== partner.structural || reverse.activeTier !== partner.activeTier)
            throw new Error(`Paire asymétrique (structural/activeTier) : ${character} <-> ${partner.character}`);
         if ((reverse.geometricScore ?? null) !== (partner.geometricScore ?? null))
            throw new Error(`Paire asymétrique (score géométrique) : ${character} <-> ${partner.character}`);
      }
   }

   // Garde-fou permanent contre la fragilité du seuil géométrique (voir le plan de
   // chantier) : ces quatre paires sont exigées par la vérification explicite de
   // l'utilisateur et ne doivent jamais disparaître silencieusement d'un rebuild.
   const missing = [];
   for (const [a, b] of REQUIRED_VERIFICATION_PAIRS) {
      const partners = recordByCharacter.get(a) || [];
      if (!partners.some((entry) => entry.character === b)) missing.push(`${a}/${b}`);
   }
   if (missing.length) {
      throw new Error(
         `Paires de vérification exigées absentes de l'index : ${missing.join(", ")}. ` +
            `Le seuil géométrique (${GEOMETRIC_ACTIVE_TIER_THRESHOLD} niveau révision) ou la formule d'échantillonnage a probablement dérivé.`,
      );
   }

   return { manifest, recordByCharacter };
}

async function validateDeterministicRebuild() {
   const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "mo-confusable-pairs-"));
   const rebuiltDirectory = path.join(temporaryRoot, "confusable-pairs");
   try {
      const { manifest: rebuiltManifest } = await buildConfusablePairsIndex({ outputDirectory: rebuiltDirectory });
      const originalManifest = JSON.parse(await readFile(path.join(generatedDirectory, "manifest.json"), "utf8"));
      if (rebuiltManifest.buildId !== originalManifest.buildId)
         throw new Error("Reconstruction non déterministe : buildId différent");

      const [expectedFiles, actualFiles] = await Promise.all([filesBelow(generatedDirectory), filesBelow(rebuiltDirectory)]);
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

const { manifest } = await validateDeclaredHashes();
await validateDeterministicRebuild();
console.log(
   `PASS confusable-pairs ${manifest.counts.finalPairCount} paires ` +
      `(${manifest.counts.activeTierPairCount} niveau révision, ${manifest.counts.passiveOnlyPairCount} niveau fiche), ` +
      `${manifest.counts.removedAsSimplifiedTraditionalVariantCount} variantes simplifié/traditionnel retirées, ` +
      `4/4 paires de vérification présentes`,
);
