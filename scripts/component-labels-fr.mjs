import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");

export const COMPONENT_LABELS_FR_RELATIVE_PATH = "data/source/character-components-fr.json";
export const COMPONENT_LABELS_FR_PATH = path.join(projectRoot, "data", "source", "character-components-fr.json");

// Même contrat que data/source/character-hints-fr.json : contenu original du
// projet, écrit à la main, jamais traduit automatiquement. Il donne le nom
// français d'un composant et prime sur le sens anglais de Make Me a Hanzi
// partout où un nom de composant est affiché (Parcours, clés de Rechercher,
// lignes « Composition » et « Origine du dessin » de la fiche).
export async function loadComponentLabelsFr(filename = COMPONENT_LABELS_FR_PATH) {
   const buffer = await readFile(filename);
   const sha256 = createHash("sha256").update(buffer).digest("hex");
   let raw;
   try {
      raw = JSON.parse(buffer.toString("utf8"));
   } catch (error) {
      throw new Error("JSON des noms de composants invalide", { cause: error });
   }
   if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Les noms de composants doivent former un objet JSON");

   const labels = {};
   for (const [rawCharacter, rawLabel] of Object.entries(raw)) {
      const character = String(rawCharacter).normalize("NFC").trim();
      const label = String(rawLabel ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
      if (Array.from(character).length !== 1 || !/^\p{Script=Han}$/u.test(character))
         throw new Error(`Caractère de composant invalide : ${JSON.stringify(rawCharacter)}`);
      if (!label) throw new Error(`Nom français vide pour ${character}`);
      // deux clés brutes distinctes peuvent se normaliser vers le même caractère
      if (Object.hasOwn(labels, character))
         throw new Error(`Nom français dupliqué pour ${character}`);
      labels[character] = label;
   }

   return {
      labels,
      sha256,
      entryCount: Object.keys(labels).length,
      path: COMPONENT_LABELS_FR_RELATIVE_PATH,
      provenance: "Original Mò Studio project content; manually written, not machine-translated",
      upstreamLicenseApplies: false,
   };
}
