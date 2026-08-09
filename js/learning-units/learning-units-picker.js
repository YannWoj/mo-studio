"use strict";

const UNITS_PAGE_SIZE = 60;
let unitsPickerFilter = "";
let unitsPickerVisible = UNITS_PAGE_SIZE;
let unitsPickerRenderToken = 0;

function unitsPickerTypeLabel(type) {
   return type === "phonetic" ? "phonétique" : "sémantique";
}

function unitsPickerRowHtml(row, index) {
   const part =
      row.partCount > 1
         ? '<span class="lu-row-part">' + row.partIndex + "/" + row.partCount + "</span>"
         : "";
   const count = row.memberCharacters.length;
   return (
      '<button class="lu-row" type="button" data-lu-index="' +
      index +
      '"><b class="lu-row-component">' +
      esc(row.component) +
      "</b>" +
      '<span class="lu-row-main">' +
      (row.componentPinyin ? '<span class="lu-row-pinyin">' + colorPinyin(row.componentPinyin) + "</span>" : "") +
      (row.componentGloss ? '<span class="lu-row-gloss">' + esc(row.componentGloss) + "</span>" : "") +
      "</span>" +
      '<span class="lu-row-meta"><span class="lu-row-badge lu-row-badge-' +
      row.type +
      '">' +
      unitsPickerTypeLabel(row.type) +
      "</span><span class=\"lu-row-count\">" +
      count +
      (count > 1 ? " caractères" : " caractère") +
      "</span>" +
      part +
      "</span></button>"
   );
}

function filteredLearningUnits(rows) {
   const visible = normalizeVisibleWhitespace(unitsPickerFilter).toLowerCase();
   if (!visible) return rows;
   const plain = normalizePinyinPlain(visible);
   const translation = normalizeTranslation(visible);
   return rows.filter(
      (row) =>
         row.component.includes(visible) ||
         (plain && normalizePinyinPlain(row.componentPinyin || "").includes(plain)) ||
         (translation && normalizeTranslation(row.componentGloss || "").includes(translation)),
   );
}

function wireLearningUnitsPicker(filtered) {
   const search = $("units-filter");
   if (search) {
      search.oninput = () => {
         unitsPickerFilter = search.value;
         unitsPickerVisible = UNITS_PAGE_SIZE;
         renderLearningUnitsList();
      };
   }
   document.querySelectorAll("[data-lu-index]").forEach((button) => {
      button.onclick = () => {
         const row = filtered[Number(button.dataset.luIndex)];
         if (row) openLesson(row.id);
      };
   });
   if ($("units-show-more"))
      $("units-show-more").onclick = () => {
         unitsPickerVisible += UNITS_PAGE_SIZE;
         renderLearningUnitsList();
      };
}

function renderLearningUnitsList() {
   const target = $("units-list");
   if (!target) return;
   const rows = learningUnitsState.index || [];
   const filtered = filteredLearningUnits(rows);
   const visible = filtered.slice(0, unitsPickerVisible);
   target.innerHTML =
      '<div class="path-level-tools"><label for="units-filter">Filtrer</label>' +
      '<input class="search" id="units-filter" type="search" placeholder="composant, pinyin ou sens…" value="' +
      esc(unitsPickerFilter) +
      '"><span class="path-filter-count" aria-live="polite">' +
      filtered.length.toLocaleString("fr-FR") +
      (filtered.length > 1 ? " leçons" : " leçon") +
      "</span></div>" +
      (visible.length
         ? '<div class="lu-list">' + visible.map(unitsPickerRowHtml).join("") + "</div>"
         : '<div class="path-no-results"><p>Aucune leçon pour cette recherche.</p></div>') +
      (visible.length < filtered.length
         ? '<div class="path-more"><button class="btn ghost" id="units-show-more" type="button">Afficher ' +
           Math.min(UNITS_PAGE_SIZE, filtered.length - visible.length) +
           " leçons de plus</button></div>"
         : "");
   const search = $("units-filter");
   if (search && unitsPickerFilter) {
      search.focus({ preventScroll: true });
      search.setSelectionRange(search.value.length, search.value.length);
   }
   wireLearningUnitsPicker(filtered);
}

async function renderLearningUnitsPicker() {
   document.body.classList.remove("in-seq", "in-lesson");
   const token = ++unitsPickerRenderToken;
   $("view").innerHTML =
      '<section class="path-page path-level-page" aria-labelledby="units-title">' +
      '<header class="path-level-header"><button class="btn ghost" id="units-back" type="button">← Retour</button>' +
      "<div><h2 class=\"v-t\" id=\"units-title\">Leçons</h2><p class=\"muted\">Un composant, les caractères qu’il débloque, une leçon complète.</p></div></header>" +
      '<section class="card path-vocabulary" id="units-list"><div class="path-loading" role="status"><span class="ink-loader"></span><span>Chargement des leçons…</span></div></section></section>';
   if ($("units-back")) $("units-back").onclick = () => setView("path");
   try {
      await loadLearningUnitsIndex();
      if (token !== unitsPickerRenderToken || activeView !== "units") return;
      renderLearningUnitsList();
   } catch (error) {
      if (token !== unitsPickerRenderToken) return;
      const target = $("units-list");
      if (target)
         target.innerHTML =
            '<div class="path-error" role="alert"><b>Leçons indisponibles.</b><p>' +
            esc(error.message) +
            '</p><button class="btn" id="units-retry" type="button">Réessayer</button></div>';
      if ($("units-retry")) $("units-retry").onclick = () => renderLearningUnitsPicker();
   }
}
