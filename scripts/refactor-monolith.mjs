import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.argv.includes("--extract-legacy-baseline")) {
   throw new Error(
      "Historical extractor only. It would overwrite the maintained search engine; " +
         "pass --extract-legacy-baseline only when intentionally recreating the original refactor baseline.",
   );
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourcePath = path.join(
   projectRoot,
   "backup",
   "mo-studio-before-refactor.html",
);

const source = await readFile(sourcePath, "utf8");

function between(text, start, end) {
   const startIndex = text.indexOf(start);
   const endIndex = text.indexOf(end, startIndex + start.length);
   if (startIndex < 0 || endIndex < 0) {
      throw new Error(`Extraction boundary not found: ${start} -> ${end}`);
   }
   return text.slice(startIndex + start.length, endIndex);
}

function sliceFromMarkers(text, start, end) {
   const startIndex = text.indexOf(start);
   const endIndex = end ? text.indexOf(end, startIndex + start.length) : text.length;
   if (startIndex < 0 || endIndex < 0) {
      throw new Error(`Section boundary not found: ${start} -> ${end}`);
   }
   return text.slice(startIndex, endIndex);
}

function dedent(text) {
   const lines = text.replace(/^\r?\n/, "").replace(/\s+$/, "").split(/\r?\n/);
   const indents = lines
      .filter((line) => line.trim())
      .map((line) => line.match(/^\s*/)[0].length);
   const amount = indents.length ? Math.min(...indents) : 0;
   return lines.map((line) => line.slice(amount)).join("\n") + "\n";
}

async function output(relativePath, content) {
   const target = path.join(projectRoot, relativePath);
   await mkdir(path.dirname(target), { recursive: true });
   await writeFile(target, content, "utf8");
}

const styleOpen = "      <style>";
const styleClose = "      </style>";
const style = between(source, styleOpen, styleClose);

const cssSections = [
   [
      "css/main.css",
      "/* ============ Mò Studio v4",
      "/* ---------- séance ---------- */",
   ],
   [
      "css/review.css",
      "/* ---------- séance ---------- */",
      "/* ---------- 米字格 ---------- */",
   ],
   [
      "css/stroke-order.css",
      "/* ---------- 米字格 ---------- */",
      "/* ---------- picker & bibliothèque ---------- */",
   ],
   [
      "css/search.css",
      "/* ---------- picker & bibliothèque ---------- */",
      "/* ---------- écoute ---------- */",
   ],
   [
      "css/listening.css",
      "/* ---------- écoute ---------- */",
      "/* ---------- grammaire ---------- */",
   ],
   [
      "css/grammar.css",
      "/* ---------- grammaire ---------- */",
      "/* ---------- sheet, toast, nav ---------- */",
   ],
   [
      "css/overlays.css",
      "/* ---------- sheet, toast, nav ---------- */",
      "/* ---------- animations & desktop ---------- */",
   ],
   [
      "css/responsive.css",
      "/* ---------- animations & desktop ---------- */",
      null,
   ],
];

for (const [file, start, end] of cssSections) {
   await output(file, dedent(sliceFromMarkers(style, start, end)));
}

const inlineScriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const scriptMatches = [...source.matchAll(inlineScriptPattern)];
if (scriptMatches.length !== 1) {
   throw new Error(`Expected one application script, found ${scriptMatches.length}`);
}
const applicationScript = scriptMatches[0][1];

const markers = {
   utilities: "/* ================= utilitaires ================= */",
   pinyin: "/* ================= pinyin ================= */",
   audio: "/* ================= audio ================= */",
   srs: "/* ================= répétition espacée (SRS) ================= */",
   data: "/* ================= données ================= */",
   sessionStorage: "/* -------- sauvegarde / reprise de séance -------- */",
   navigation: "/* ================= navigation ================= */",
   home: "/* ================= hub (Réviser) ================= */",
   review: "/* ================= séance ================= */",
   library: "/* ================= bibliothèque (库) ================= */",
   dictionary: "/* ================= dictionnaire de référence (查) ================= */",
   dictionaryIndex: "/* -------- index unifié : cartes perso + référence, dédoublonné -------- */",
   normalization: "/* -------- recherche : 汉字, pinyin numéroté/accentué, pinyin sans ton -------- */",
   rankFunction: "function rankOf(e) {",
   searchFunction: "function searchDict(qRaw, limit) {",
   searchView: "/* -------- page Rechercher : état et rendu -------- */",
   dictionaryDetail: "/* -------- fiche détaillée + tracé (partagée : résultat de recherche & séquence) -------- */",
   cardActions: "function cardActionsHtml(card) {",
   sequence: "/* -------- séquence swipeable (pour lire plusieurs caractères à la suite) -------- */",
   listening: "/* ================= écoute (听) ================= */",
   grammar: "/* ================= grammaire (法) ================= */",
   settings: "/* ================= réglages ================= */",
   transfer: "/* ================= import / export ================= */",
   ui: "/* ================= sheet & toast ================= */",
   initialization: "/* ================= initialisation ================= */",
};

function strictSection(start, end) {
   return '"use strict";\n\n' + dedent(sliceFromMarkers(applicationScript, start, end));
}

const normalization =
   strictSection(markers.pinyin, markers.audio) +
   "\n" +
   strictSection(markers.normalization, markers.searchFunction);
await output("js/search/normalization.js", normalization);

const javascriptSections = [
   ["js/utils.js", markers.utilities, markers.pinyin],
   ["js/audio.js", markers.audio, markers.srs],
   ["js/state.js", markers.srs, markers.data],
   ["js/storage.js", markers.data, markers.navigation],
   ["js/history.js", markers.navigation, markers.home],
   ["js/views/home.js", markers.home, markers.review],
   ["js/views/review.js", markers.review, markers.library],
   ["js/views/library.js", markers.library, markers.dictionary],
   ["js/dictionary/dictionary-store.js", markers.dictionary, markers.rankFunction],
   ["js/search/ranking.js", markers.rankFunction, markers.normalization],
   ["js/search/search-engine.js", markers.searchFunction, markers.searchView],
   ["js/search/search-view.js", markers.searchView, markers.dictionaryDetail],
   ["js/strokes/writer-controller.js", markers.dictionaryDetail, markers.cardActions],
   ["js/dictionary/dictionary-detail.js", markers.cardActions, markers.sequence],
   ["js/strokes/sequence-viewer.js", markers.sequence, markers.listening],
   ["js/views/listening.js", markers.listening, markers.grammar],
   ["js/views/grammar.js", markers.grammar, markers.settings],
   ["js/views/settings.js", markers.settings, markers.transfer],
   ["js/storage-transfer.js", markers.transfer, markers.ui],
   ["js/ui.js", markers.ui, markers.initialization],
   ["js/app.js", markers.initialization, null],
];

for (const [file, start, end] of javascriptSections) {
   await output(file, strictSection(start, end));
}

const settingsPath = "js/views/settings.js";
const enhancedSettings = strictSection(markers.settings, markers.transfer)
   .replace(
      `'<button class="btn ghost" id="st-format">Format JSON</button>' +`,
      `'<button class="btn ghost" id="st-format">Format JSON</button>' +\n` +
         `                  '<button class="btn ghost" id="st-dictionary-sources">Sources du dictionnaire</button>' +`,
   )
   .replace(
      `$("st-format").onclick = openFormatSheet;`,
      `$("st-format").onclick = openFormatSheet;\n` +
         `            $("st-dictionary-sources").onclick = openDictionarySources;`,
   );
await output(settingsPath, enhancedSettings);

const head = source.slice(0, source.indexOf(styleOpen));
const afterStyle = source.slice(source.indexOf(styleClose) + styleClose.length);
const scriptStartInRemainder = afterStyle.indexOf(scriptMatches[0][0]);
if (scriptStartInRemainder < 0) {
   throw new Error("Application script was not found after the style block");
}
const bodyBeforeScript = afterStyle
   .slice(0, scriptStartInRemainder)
   .replace(/[ \t]+$/, "");
const bodyAfterScript = afterStyle.slice(scriptStartInRemainder + scriptMatches[0][0].length);

const stylesheetTags = cssSections
   .map(([file]) => `      <link rel="stylesheet" href="${file.replaceAll("\\", "/")}" />`)
   .join("\n");
const scriptTags = javascriptSections
   .map(
      ([file]) =>
         `      <script data-mo-app src="${file.replaceAll("\\", "/")}"></script>`,
   )
   .join("\n");

const [utilitiesTag, ...remainingScriptTags] = scriptTags.split("\n");
const legacyOrderedScriptTags = [
   utilitiesTag,
   '      <script data-mo-app src="js/search/normalization.js"></script>',
   ...remainingScriptTags,
];
const orderedScriptTags = legacyOrderedScriptTags
   .flatMap((tag) =>
      tag.includes("js/dictionary/dictionary-store.js")
         ? [
              tag,
              '      <script data-mo-app src="js/dictionary/dictionary-loader.js"></script>',
              '      <script data-mo-app src="js/dictionary/source-attribution.js"></script>',
           ]
         : [tag],
   )
   .join("\n");

const html = `${head}${stylesheetTags}${bodyBeforeScript}${orderedScriptTags}${bodyAfterScript}`;
await output("index.html", html);
await output("mo-studio.html", html);

console.log(
   `Extracted ${cssSections.length} CSS files and ${javascriptSections.length + 3} JavaScript files.`,
);
