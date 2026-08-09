"use strict";

/* ================= parcours HSK (学) ================= */
const PATH_PAGE_SIZE = 80;
const PATH_MAP_PAGE_SIZE = 12;
let openPathLevel = null;
let pathRenderToken = 0;
let pathLevelEntries = [];
let pathLevelFilter = "";
let pathLevelVisible = PATH_PAGE_SIZE;

/* ================= parcours : recommandation + carte ================= */
let pathHomeState = null;
let pathHomeRenderToken = 0;
let pathMapVisible = {
   acquis: PATH_MAP_PAGE_SIZE,
   disponibles: PATH_MAP_PAGE_SIZE,
   bientot: PATH_MAP_PAGE_SIZE,
   verrouillees: PATH_MAP_PAGE_SIZE,
};

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
   const allLessons = $("path-all-lessons");
   if (allLessons) allLessons.onclick = () => setView("units");
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

function pathExploreSectionHtml(manifest) {
   return (
      '<section class="path-explore" id="path-explore-shell">' +
      '<h3 class="eyebrow">Explorer</h3>' +
      '<button class="btn ghost wide" id="path-all-lessons" type="button">Voir toutes les leçons</button>' +
      pathGrammarCardHtml() +
      '<section class="card pad path-continue" aria-labelledby="path-continue-title">' +
      '<h3 id="path-continue-title">Explorer le vocabulaire HSK</h3>' +
      "<p><b>" +
      manifest.totalEntries.toLocaleString("fr-FR") +
      " entrées</b> disponibles. Les leçons et exercices ne sont pas encore créés.</p></section>" +
      '<div class="path-levels" aria-label="Niveaux HSK">' +
      [1, 2, 3, 4, 5, 6].map((level) => pathLevelCardHtml(manifest, level)).join("") +
      "</div></section>"
   );
}

/* ================= sélecteur de périmètre ================= */
function pathScopeSelectorHtml(scope) {
   const modes = [
      ["personal", "Mes mots"],
      ["hsk", "Niveau HSK"],
      ["all", "Tout le vocabulaire"],
   ];
   return (
      '<div class="card pad path-scope" id="path-scope">' +
      '<div class="eyebrow">Périmètre</div>' +
      '<div class="path-scope-segments" role="group" aria-label="Périmètre du parcours">' +
      modes
         .map(
            ([mode, label]) =>
               '<button type="button" class="path-scope-segment" data-scope-mode="' +
               mode +
               '" aria-pressed="' +
               String(scope.mode === mode) +
               '">' +
               esc(label) +
               "</button>",
         )
         .join("") +
      "</div>" +
      (scope.mode === "hsk"
         ? '<div class="path-scope-hsk-levels" role="group" aria-label="Niveau HSK visé">' +
           [1, 2, 3, 4, 5, 6]
              .map(
                 (level) =>
                    '<button type="button" class="path-scope-hsk-level" data-scope-hsk-level="' +
                    level +
                    '" aria-pressed="' +
                    String(scope.hskLevel === level) +
                    '">' +
                    level +
                    "</button>",
              )
              .join("") +
           "</div>"
         : "") +
      "</div>"
   );
}

function wirePathScopeSelector() {
   document.querySelectorAll("[data-scope-mode]").forEach((button) => {
      button.onclick = () => {
         setCourseScope(button.dataset.scopeMode, getCourseScope().hskLevel);
         repaintPathScope();
      };
   });
   document.querySelectorAll("[data-scope-hsk-level]").forEach((button) => {
      button.onclick = () => {
         setCourseScope("hsk", Number(button.dataset.scopeHskLevel));
         repaintPathScope();
      };
   });
}

function repaintPathScope() {
   const container = $("path-scope");
   if (container) container.outerHTML = pathScopeSelectorHtml(getCourseScope());
   wirePathScopeSelector();
   renderPathPrimary();
}

/* ================= zone primaire : prochaine leçon, progression, carte ================= */
function pathNextLessonHtml(unit) {
   const preview = unit.memberCharacters.slice(0, 8);
   const extra = unit.memberCharacters.length - preview.length;
   return (
      '<div class="card pad path-next"><div class="eyebrow">Prochaine leçon</div>' +
      '<div class="path-next-head"><b class="path-next-hz">' +
      esc(unit.component) +
      '</b><span class="path-next-main">' +
      (unit.componentPinyin ? '<span class="path-next-pinyin">' + colorPinyin(unit.componentPinyin) + "</span>" : "") +
      (unit.componentGloss ? '<span class="path-next-gloss">' + esc(unit.componentGloss) + "</span>" : "") +
      "</span></div>" +
      '<div class="path-next-chars" aria-label="Caractères débloqués par cette leçon">' +
      preview.map((character) => '<span class="chip hzchip">' + esc(character) + "</span>").join("") +
      (extra > 0 ? '<span class="path-next-more">+' + extra + "</span>" : "") +
      "</div>" +
      '<button class="btn primary wide" id="path-next-start" type="button">Commencer</button></div>'
   );
}

function pathProgressHtml(progress) {
   const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
   const remaining = progress.total - progress.completed;
   return (
      '<div class="card pad path-progress">' +
      '<div class="path-progress-count">' +
      progress.completed.toLocaleString("fr-FR") +
      " / " +
      progress.total.toLocaleString("fr-FR") +
      " leçons</div>" +
      '<div class="s-bar"><i style="width:' +
      percent +
      '%"></i></div>' +
      '<p class="path-progress-note">' +
      (remaining === 0
         ? "Périmètre entièrement terminé."
         : remaining + " leçon" + (remaining > 1 ? "s" : "") + " restante" + (remaining > 1 ? "s" : "") + " dans ce périmètre.") +
      "</p></div>"
   );
}

function pathEmptyScopeHtml() {
   return (
      '<div class="card pad path-scope-note-card">' +
      "<p>Vous n'avez pas encore de mots personnels à partir desquels construire un parcours.</p>" +
      "<p>Choisissez un niveau HSK ou tout le vocabulaire ci-dessus pour démarrer, ou ajoutez des mots à Mes mots.</p></div>"
   );
}

function pathScopeCompleteHtml() {
   return (
      '<div class="card pad path-scope-note-card">' +
      "<p><b>Bravo — vous avez terminé toutes les leçons de ce périmètre.</b></p>" +
      "<p>Choisissez un périmètre plus large pour continuer : le total augmente si vous ajoutez du vocabulaire, ce n'est pas une régression.</p></div>"
   );
}

function pathStuckHtml() {
   return (
      '<div class="card pad path-scope-note-card">' +
      "<p>Aucune leçon n'est disponible dans ce périmètre pour l'instant — un composant nécessaire n'y figure pas.</p>" +
      "<p>Élargissez le périmètre, ou ajoutez ce composant à Mes mots pour continuer.</p></div>"
   );
}

function pathMapAcquisRowHtml(row) {
   return (
      '<div class="lu-row path-map-row path-map-row-acquis"><b class="lu-row-component">' +
      esc(row.component) +
      '</b><span class="lu-row-main"><span class="unit-family-tag key">acquis</span></span>' +
      (row.remainingCount > 0
         ? '<button class="path-map-remaining" type="button" data-path-map-open="' +
           esc(row.bestUnit.id) +
           '">→ ' +
           row.remainingCount +
           (row.remainingCount > 1 ? " leçons restantes" : " leçon restante") +
           "</button>"
         : '<span class="lu-row-meta">terminé</span>') +
      "</div>"
   );
}

function pathMapDisponibleRowHtml(row) {
   return (
      '<button class="lu-row path-map-row path-map-row-disponible" type="button" data-path-map-open="' +
      esc(row.bestUnit.id) +
      '"><b class="lu-row-component">' +
      esc(row.component) +
      '</b><span class="lu-row-main">' +
      (row.bestUnit.componentPinyin ? '<span class="lu-row-pinyin">' + colorPinyin(row.bestUnit.componentPinyin) + "</span>" : "") +
      (row.bestUnit.componentGloss ? '<span class="lu-row-gloss">' + esc(row.bestUnit.componentGloss) + "</span>" : "") +
      '</span><span class="lu-row-meta">' +
      row.bestUnit.memberCharacters.length +
      " caractères</span></button>"
   );
}

function pathMapBientotRowHtml(row, disponiblesByComponent) {
   const missingComponent = row.missing[0];
   const unlockUnit = disponiblesByComponent.get(missingComponent);
   const inner =
      '<b class="lu-row-component">' +
      esc(row.component) +
      '</b><span class="lu-row-main"><span class="unit-family-tag path-map-gap">manque ' +
      esc(missingComponent) +
      '</span></span><span class="lu-row-meta">' +
      row.charactersWaiting +
      " caractères</span>";
   return unlockUnit
      ? '<button class="lu-row path-map-row path-map-row-bientot" type="button" data-path-map-open="' +
           esc(unlockUnit.id) +
           '" title="Apprendre ' +
           esc(missingComponent) +
           ' pour débloquer">' +
           inner +
           "</button>"
      : '<div class="lu-row path-map-row path-map-row-bientot">' + inner + "</div>";
}

function pathMapVerrouilleeRowHtml(row) {
   return (
      '<div class="lu-row path-map-row path-map-row-verrouillee"><b class="lu-row-component">' +
      esc(row.component) +
      '</b><span class="lu-row-main"><span class="lu-row-gloss">manque ' +
      row.missing.map(esc).join(", ") +
      '</span></span><span class="lu-row-meta">' +
      row.charactersWaiting +
      " caractères</span></div>"
   );
}

function pathMapBucketHtml(title, rows, kind, rowFn) {
   const visibleCount = pathMapVisible[kind];
   const visible = rows.slice(0, visibleCount);
   return (
      '<div class="path-map-bucket path-map-bucket-' +
      kind +
      '"><h4 class="path-map-bucket-title">' +
      esc(title) +
      ' <span class="path-map-bucket-count">' +
      rows.length +
      "</span></h4>" +
      (visible.length
         ? '<div class="path-map-rows">' + visible.map(rowFn).join("") + "</div>"
         : '<p class="path-map-bucket-empty">Rien ici pour l\'instant.</p>') +
      (visible.length < rows.length
         ? '<button class="btn ghost sm" type="button" data-path-map-more="' +
           kind +
           '">Afficher ' +
           Math.min(PATH_MAP_PAGE_SIZE, rows.length - visible.length) +
           " de plus</button>"
         : "") +
      "</div>"
   );
}

function pathMapHtml(buckets) {
   const disponiblesByComponent = new Map(buckets.disponibles.map((row) => [row.component, row.bestUnit]));
   return (
      '<section class="path-map"><h3 class="eyebrow">La carte</h3>' +
      pathMapBucketHtml("Acquis", buckets.acquis, "acquis", pathMapAcquisRowHtml) +
      pathMapBucketHtml("Disponibles", buckets.disponibles, "disponibles", pathMapDisponibleRowHtml) +
      pathMapBucketHtml("Bientôt", buckets.bientot, "bientot", (row) => pathMapBientotRowHtml(row, disponiblesByComponent)) +
      pathMapBucketHtml("Verrouillées", buckets.verrouillees, "verrouillees", pathMapVerrouilleeRowHtml) +
      "</section>"
   );
}

function wirePathPrimary(state) {
   const startButton = $("path-next-start");
   if (startButton && state.recommended) startButton.onclick = () => openLesson(state.recommended.id);
   document.querySelectorAll("[data-path-map-open]").forEach((button) => {
      button.onclick = () => openLesson(button.dataset.pathMapOpen);
   });
   document.querySelectorAll("[data-path-map-more]").forEach((button) => {
      button.onclick = () => {
         pathMapVisible[button.dataset.pathMapMore] += PATH_MAP_PAGE_SIZE;
         paintPathPrimary(pathHomeState);
      };
   });
}

function paintPathPrimary(state) {
   const target = $("path-primary");
   if (!target) return;
   let body = "";
   if (!state.progress.total) body = pathEmptyScopeHtml();
   else if (state.recommended) body = pathNextLessonHtml(state.recommended) + pathProgressHtml(state.progress);
   else if (state.progress.completed === state.progress.total) body = pathScopeCompleteHtml() + pathProgressHtml(state.progress);
   else body = pathStuckHtml() + pathProgressHtml(state.progress);
   if (state.progress.total) body += pathMapHtml(state.buckets);
   target.outerHTML = '<section class="path-primary" id="path-primary">' + body + "</section>";
   wirePathPrimary(state);
}

async function renderPathPrimary() {
   pathMapVisible = {
      acquis: PATH_MAP_PAGE_SIZE,
      disponibles: PATH_MAP_PAGE_SIZE,
      bientot: PATH_MAP_PAGE_SIZE,
      verrouillees: PATH_MAP_PAGE_SIZE,
   };
   const token = ++pathHomeRenderToken;
   const target = $("path-primary");
   if (target) {
      target.setAttribute("aria-busy", "true");
      target.innerHTML = '<span class="ink-loader" aria-hidden="true"></span><span>Calcul du parcours…</span>';
   }
   try {
      const state = await computeLearningPath();
      if (token !== pathHomeRenderToken || activeView !== "path" || openPathLevel != null) return;
      pathHomeState = state;
      paintPathPrimary(state);
   } catch (error) {
      if (token !== pathHomeRenderToken) return;
      const el = $("path-primary");
      if (el)
         el.innerHTML =
            '<div class="path-error" role="alert"><b>Parcours indisponible.</b><p>' +
            esc(error.message) +
            '</p><button class="btn" id="path-primary-retry" type="button">Réessayer</button></div>';
      if ($("path-primary-retry")) $("path-primary-retry").onclick = () => renderPathPrimary();
   }
}

/* ================= écran d'accueil ================= */
async function renderPathHome(token) {
   const root = $("view");
   root.innerHTML =
      '<section class="path-page" aria-labelledby="path-title">' +
      '<header class="path-header"><div class="path-mark">学</div><div><h2 class="v-t" id="path-title">学 · Parcours</h2>' +
      "<p class=\"muted\">Votre prochaine leçon, choisie pour vous, et la carte de ce qu'il reste à débloquer.</p></div></header>" +
      pathScopeSelectorHtml(getCourseScope()) +
      '<section class="path-primary" id="path-primary" role="status" aria-busy="true"><span class="ink-loader" aria-hidden="true"></span><span>Calcul du parcours…</span></section>' +
      '<section class="path-loading" role="status" id="path-explore-shell"><span class="ink-loader" aria-hidden="true"></span><span>Chargement des niveaux HSK…</span></section>' +
      "</section>";
   wirePathScopeSelector();
   renderPathPrimary();
   try {
      const manifest = await loadHskManifest();
      if (token !== pathRenderToken || activeView !== "path" || openPathLevel != null) return;
      const shell = $("path-explore-shell");
      if (shell) shell.outerHTML = pathExploreSectionHtml(manifest);
      wirePathHome();
   } catch (error) {
      if (token !== pathRenderToken) return;
      const shell = $("path-explore-shell");
      if (shell)
         shell.outerHTML =
            '<section class="card pad path-error" role="alert" id="path-explore-shell"><b>Données HSK indisponibles.</b><p>' +
            esc(error.message) +
            '</p><button class="btn" id="path-retry" type="button">Réessayer</button></section>';
      if ($("path-retry")) $("path-retry").onclick = () => renderPath();
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
   document.body.classList.remove("in-seq", "in-lesson");
   const token = ++pathRenderToken;
   if (openPathLevel == null) renderPathHome(token);
   else renderPathLevel(openPathLevel, token);
}
