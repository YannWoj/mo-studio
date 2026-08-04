"use strict";

/* ================= parcours HSK (学) ================= */
const PATH_PAGE_SIZE = 80;
let openPathLevel = null;
let pathRenderToken = 0;
let pathLevelEntries = [];
let pathLevelFilter = "";
let pathLevelVisible = PATH_PAGE_SIZE;

function pathLevelCount(manifest, level) {
   return Number(manifest.countsByFirstHskLevel[level] || 0);
}

function pathLevelCardHtml(manifest, level) {
   const count = pathLevelCount(manifest, level);
   return (
      '<button class="card path-level" type="button" data-path-level="' +
      level +
      '" data-path-level-count="' +
      count +
      '"><span><span class="path-level-title">HSK ' +
      level +
      '</span><span class="path-level-order">Premier niveau HSK</span></span>' +
      '<span class="path-level-note"><b>' +
      count.toLocaleString("fr-FR") +
      "</b> entrées de vocabulaire</span></button>"
   );
}

function wirePathHome() {
   document.querySelectorAll("[data-path-level]").forEach((button) => {
      button.onclick = () => {
         openPathLevel = Number(button.dataset.pathLevel);
         pathLevelFilter = "";
         pathLevelVisible = PATH_PAGE_SIZE;
         renderPath();
         window.scrollTo(0, 0);
      };
   });
   const grammar = $("path-grammar");
   if (grammar) grammar.onclick = () => setView("grammar");
}

function pathGrammarCardHtml() {
   return (
      '<button class="card path-grammar" id="path-grammar" type="button">' +
      '<span class="path-grammar-mark" aria-hidden="true">法</span>' +
      '<span class="path-grammar-copy"><strong>Grammaire</strong>' +
      '<span>Comprendre les structures essentielles, écouter les exemples et s\'entraîner avec les mini-quiz.</span></span>' +
      '<span class="path-grammar-arrow" aria-hidden="true">→</span></button>'
   );
}

async function renderPathHome(token) {
   const root = $("view");
   root.innerHTML =
      '<section class="path-page" aria-labelledby="path-title">' +
      '<header class="path-header"><div class="path-mark">学</div><div><h2 class="v-t" id="path-title">学 · Parcours</h2>' +
      '<p class="muted">Vocabulaire officiel HSK 1 à 6, classé par premier niveau.</p></div></header>' +
      '<section class="card pad path-loading" role="status"><span class="ink-loader" aria-hidden="true"></span><span>Chargement des niveaux HSK…</span></section></section>';
   try {
      const manifest = await loadHskManifest();
      if (token !== pathRenderToken || activeView !== "path" || openPathLevel != null) return;
      root.innerHTML =
         '<section class="path-page" aria-labelledby="path-title">' +
         '<header class="path-header"><div class="path-mark">学</div><div><h2 class="v-t" id="path-title">学 · Parcours</h2>' +
         '<p class="muted">Vocabulaire officiel HSK 1 à 6, classé par premier niveau.</p></div></header>' +
         '<section class="card pad path-continue" aria-labelledby="path-continue-title">' +
         '<h3 id="path-continue-title">Explorer le vocabulaire HSK</h3>' +
         '<p><b>' +
         manifest.totalEntries.toLocaleString("fr-FR") +
         " entrées</b> disponibles. Les leçons et exercices ne sont pas encore créés.</p></section>" +
         pathGrammarCardHtml() +
         '<div class="path-levels" aria-label="Niveaux HSK">' +
         [1, 2, 3, 4, 5, 6].map((level) => pathLevelCardHtml(manifest, level)).join("") +
         "</div></section>";
      wirePathHome();
   } catch (error) {
      if (token !== pathRenderToken) return;
      root.innerHTML =
         '<section class="path-page"><header class="path-header"><div class="path-mark">学</div><div><h2 class="v-t" id="path-title">学 · Parcours</h2></div></header>' +
         '<section class="card pad path-error" role="alert"><b>Données HSK indisponibles.</b><p>' +
         esc(error.message) +
         '</p><button class="btn" id="path-retry" type="button">Réessayer</button></section></section>';
      $("path-retry").onclick = () => renderPath();
   }
}

function pathStatusBadge(entry) {
   const status = entry.dictionaryLinkStatus;
   if (!["ambiguous", "source-only", "duplicate-sense"].includes(status)) return "";
   return (
      '<span class="path-word-status status-' +
      esc(status) +
      '">' +
      esc(hskLinkStatusLabel(status)) +
      "</span>"
   );
}

function pathVocabularyRowHtml(entry, index) {
   const sourceLevels = Array.isArray(entry.sourceLevels) ? entry.sourceLevels : [];
   return (
      '<button class="path-word" type="button" data-path-word-index="' +
      index +
      '" data-hsk-entry-id="' +
      esc(entry.hskEntryId) +
      '"><span class="path-word-hanzi">' +
      esc(entry.chinese) +
      '</span><span class="path-word-main"><span class="path-word-pinyin">' +
      colorPinyin(entry.pinyin) +
      '</span><span class="path-word-translation">' +
      esc(entry.sourceTranslation) +
      "</span>" +
      (entry.partOfSpeech || sourceLevels.length > 1
         ? '<small class="path-word-meta">' +
           (entry.partOfSpeech ? esc(entry.partOfSpeech) : "") +
           (entry.partOfSpeech && sourceLevels.length > 1 ? " · " : "") +
           (sourceLevels.length > 1 ? "niveaux source " + sourceLevels.map(esc).join(", ") : "") +
           "</small>"
         : "") +
      '</span><span class="path-word-badges"><span class="hsk-badge hsk-level-' +
      entry.firstHskLevel +
      '" data-hsk-badge="' +
      entry.firstHskLevel +
      '">HSK ' +
      entry.firstHskLevel +
      "</span>" +
      pathStatusBadge(entry) +
      "</span></button>"
   );
}

function filteredPathEntries() {
   const visible = normalizeVisibleWhitespace(pathLevelFilter).toLowerCase();
   if (!visible) return pathLevelEntries;
   const plain = normalizePinyinPlain(visible);
   const translation = normalizeTranslation(visible);
   return pathLevelEntries.filter(
      (entry) =>
         entry.chinese.includes(visible) ||
         (plain && normalizePinyinPlain(entry.pinyin).includes(plain)) ||
         (translation && normalizeTranslation(entry.sourceTranslation).includes(translation)),
   );
}

function wirePathVocabulary(filtered) {
   const search = $("path-level-search");
   if (search) {
      search.oninput = () => {
         pathLevelFilter = search.value;
         pathLevelVisible = PATH_PAGE_SIZE;
         renderPathVocabulary();
      };
   }
   document.querySelectorAll("[data-path-word-index]").forEach((button) => {
      button.onclick = async () => {
         const entry = filtered[Number(button.dataset.pathWordIndex)];
         if (!entry) return;
         openSheet(
            '<div class="dictionary-loading"><span class="ink-loader"></span><b>Chargement de la fiche…</b></div>',
         );
         await openHskVocabularyEntry(entry);
      };
   });
   if ($("path-show-more"))
      $("path-show-more").onclick = () => {
         pathLevelVisible += PATH_PAGE_SIZE;
         renderPathVocabulary();
      };
}

function renderPathVocabulary() {
   const target = $("path-vocabulary");
   if (!target) return;
   const filtered = filteredPathEntries();
   const visible = filtered.slice(0, pathLevelVisible);
   target.innerHTML =
      '<div class="path-level-tools"><label for="path-level-search">Filtrer ce niveau</label>' +
      '<input class="search" id="path-level-search" type="search" placeholder="汉字, pinyin ou traduction…" value="' +
      esc(pathLevelFilter) +
      '"><span class="path-filter-count" aria-live="polite">' +
      filtered.length.toLocaleString("fr-FR") +
      (filtered.length > 1 ? " entrées" : " entrée") +
      "</span></div>" +
      (visible.length
         ? '<div class="path-word-list" data-path-word-list>' +
           visible.map(pathVocabularyRowHtml).join("") +
           "</div>"
         : '<div class="path-no-results"><p>Aucun mot dans ce niveau pour cette recherche.</p></div>') +
      (visible.length < filtered.length
         ? '<div class="path-more"><button class="btn ghost" id="path-show-more" type="button">Afficher ' +
           Math.min(PATH_PAGE_SIZE, filtered.length - visible.length).toLocaleString("fr-FR") +
           " entrées de plus</button></div>"
         : "");
   const search = $("path-level-search");
   if (search && pathLevelFilter) {
      search.focus({ preventScroll: true });
      search.setSelectionRange(search.value.length, search.value.length);
   }
   wirePathVocabulary(filtered);
}

function renderPathLevelFrame(level, count) {
   $("view").innerHTML =
      '<section class="path-page path-level-page" aria-labelledby="path-level-title">' +
      '<header class="path-level-header"><button class="btn ghost" id="path-level-back" type="button">← Retour</button>' +
      '<div><h2 class="v-t" id="path-level-title">HSK ' +
      level +
      '</h2><p class="muted"><span data-path-current-count>' +
      count.toLocaleString("fr-FR") +
      "</span> entrées classées par <code>firstHskLevel</code></p></div></header>" +
      '<p class="path-scope-note">Vocabulaire uniquement · aucune leçon ni aucun exercice.</p>' +
      '<section class="card path-vocabulary" id="path-vocabulary"><div class="path-loading" role="status"><span class="ink-loader"></span><span>Chargement du vocabulaire…</span></div></section></section>';
   $("path-level-back").onclick = () => {
      openPathLevel = null;
      pathLevelEntries = [];
      pathLevelFilter = "";
      renderPath();
      window.scrollTo(0, 0);
   };
}

async function renderPathLevel(level, token) {
   try {
      const manifest = await loadHskManifest();
      if (token !== pathRenderToken || activeView !== "path" || openPathLevel !== level) return;
      renderPathLevelFrame(level, pathLevelCount(manifest, level));
      const entries = await loadHskLevel(level);
      if (token !== pathRenderToken || activeView !== "path" || openPathLevel !== level) return;
      pathLevelEntries = entries;
      renderPathVocabulary();
   } catch (error) {
      if (token !== pathRenderToken) return;
      const target = $("path-vocabulary");
      if (target)
         target.innerHTML =
            '<div class="path-error" role="alert"><b>Vocabulaire indisponible.</b><p>' +
            esc(error.message) +
            '</p><button class="btn" id="path-level-retry">Réessayer</button></div>';
      if ($("path-level-retry")) $("path-level-retry").onclick = () => renderPath();
   }
}

function renderPath() {
   document.body.classList.remove("in-seq");
   const token = ++pathRenderToken;
   if (openPathLevel == null) renderPathHome(token);
   else renderPathLevel(openPathLevel, token);
}
