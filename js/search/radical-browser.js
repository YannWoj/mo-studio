"use strict";

const RADICAL_PAGE_SIZE = 32;

let radicalBrowser = {
   active: false,
   radical: null,
   catalog: null,
   filter: "",
   visible: RADICAL_PAGE_SIZE,
   members: null,
};
const radicalMembersCache = new Map();

function radicalHistoryPayload(radical) {
   return {
      moStudioSearch: true,
      mode: "radical",
      q: srch.q,
      radical: radical || null,
      visible:
         radical && radical === radicalBrowser.radical
            ? radicalBrowser.visible
            : RADICAL_PAGE_SIZE,
      scrollY: window.scrollY,
   };
}

function setRadicalPanelVisible(active) {
   radicalBrowser.active = active;
   const normal = $("dsearch-normal");
   const panel = $("dradical-panel");
   if (normal) normal.hidden = active;
   if (panel) panel.hidden = !active;
   syncRadicalHeader();
}

function radicalLoadingHtml(label) {
   return (
      '<div class="dictionary-loading" role="status" aria-live="polite"><span class="ink-loader" aria-hidden="true"></span><b>' +
      esc(label || "Chargement des clés…") + "</b></div>"
   );
}

async function openRadicalMode(options) {
   const settings = options || {};
   radicalBrowser.radical = null;
   radicalBrowser.filter = "";
   setRadicalPanelVisible(true);
   if (!settings.fromHistory) history.pushState(radicalHistoryPayload(null), "");
   const panel = $("dradical-panel");
   if (panel) panel.innerHTML = radicalLoadingHtml();
   try {
      radicalBrowser.catalog = await loadRadicalCatalog();
   } catch (error) {
      radicalBrowser.catalog = [];
   }
   if (radicalBrowser.active && !radicalBrowser.radical) {
      renderRadicalTable();
      requestAnimationFrame(() => window.scrollTo(0, settings.fromHistory ? Number(settings.scrollY) || 0 : 0));
   }
}

function radicalGroupHeading(strokeCount) {
   if (strokeCount == null) return "Nombre de traits inconnu";
   return strokeCount + " trait" + (strokeCount > 1 ? "s" : "");
}

function radicalCatalogRow(radical) {
   const catalog = Array.isArray(radicalBrowser.catalog) ? radicalBrowser.catalog : [];
   return catalog.find((row) => row.radical === radical) || null;
}

function radicalLinkedForm(sens) {
   if (!sens) return null;
   const match = sens.match(/forme liée(?: simplifiée)? de\s+(\p{Script=Han}+)/iu);
   return match ? { origin: match[1] } : null;
}

function radicalContextHeaderHtml(row, resolvedMemberCount) {
   const radical = row?.radical || radicalBrowser.radical || "";
   const sens = typeof row?.sens === "string" ? row.sens.trim() : "";
   const linked = radicalLinkedForm(sens);
   const memberCount = Number.isInteger(row?.memberCount)
      ? row.memberCount
      : Math.max(0, Number(resolvedMemberCount) || 0);
   const strokeLabel = radicalGroupHeading(row?.strokeCount == null ? null : row.strokeCount);
   const memberLabel = memberCount + " caractère" + (memberCount > 1 ? "s" : "") + " associé" +
      (memberCount > 1 ? "s" : "");
   return (
      '<section class="radical-context-card" aria-labelledby="radical-context-title">' +
      '<div class="radical-context-actions"><button type="button" class="radical-context-back" id="radical-back">' +
      '<span aria-hidden="true">←</span> Toutes les clés</button></div>' +
      '<div class="radical-context-body"><div class="radical-context-glyph" lang="zh-Hans" role="img" aria-label="Clé ' +
      esc(radical) + '">' + esc(radical) + '</div><div class="radical-context-copy">' +
      '<h3 class="eyebrow" id="radical-context-title">Clé sélectionnée</h3>' +
      '<p class="radical-context-sense' + (sens ? "" : " is-unavailable") + '">' +
      esc(sens || "Sens français vérifié indisponible") + '</p><div class="radical-context-meta">' +
      '<span data-radical-strokes>' + esc(strokeLabel) + '</span>' +
      '<span data-radical-count>' + esc(memberLabel) + '</span>' +
      (linked ? '<span class="is-linked" data-radical-linked>Forme liée · <b lang="zh-Hans">' + esc(linked.origin) + '</b></span>' : "") +
      '</div></div></div></section>'
   );
}

function syncRadicalHeader(resolvedMemberCount) {
   const hero = $("search-hero");
   const pageTitle = $("search-page-title");
   const description = $("search-hero-description");
   const toggle = $("search-mode-toggle");
   const modeIcon = toggle && toggle.querySelector("[data-search-mode-icon]");
   const modeLabel = toggle && toggle.querySelector("[data-search-mode-label]");
   const context = $("radical-context-host");
   if (!hero || !toggle || !context) return;
   const selected = radicalBrowser.active && !!radicalBrowser.radical;
   hero.classList.toggle("is-radical-mode", radicalBrowser.active);
   hero.classList.toggle("has-radical-selection", selected);
   toggle.setAttribute("aria-pressed", String(radicalBrowser.active));
   toggle.setAttribute("aria-label", radicalBrowser.active ? "Quitter le mode Clés" : "Parcourir par clés");
   if (pageTitle) pageTitle.textContent = radicalBrowser.active ? "部 · Clés" : "查 · Rechercher";
   if (modeIcon) modeIcon.textContent = radicalBrowser.active ? "×" : "部";
   if (modeLabel) modeLabel.textContent = radicalBrowser.active ? "Quitter les clés" : "Clés";
   if (description) {
      description.hidden = selected;
      description.textContent = radicalBrowser.active
         ? "Choisis une clé pour explorer les caractères qui l’utilisent."
         : "Trouve un caractère, un mot, un pinyin ou une traduction.";
   }
   context.hidden = !selected;
   if (!selected) {
      context.innerHTML = "";
      return;
   }
   context.innerHTML = radicalContextHeaderHtml(radicalCatalogRow(radicalBrowser.radical), resolvedMemberCount);
   const back = $("radical-back");
   if (back) back.onclick = () => backToRadicalTable();
}

function radicalMatchesFilter(row, filter) {
   if (!filter) return true;
   const needle = filter.trim().toLowerCase();
   if (!needle) return true;
   if (row.radical.includes(filter.trim())) return true;
   if (row.sens && row.sens.toLowerCase().includes(needle)) return true;
   if (row.strokeCount != null && String(row.strokeCount) === needle) return true;
   return false;
}

function radicalChipHtml(row) {
   return (
      '<button type="button" class="radical-chip" data-radical="' + esc(row.radical) + '" aria-label="Clé ' +
      esc(row.radical) + (row.sens ? " · " + esc(row.sens) : "") + " · " + row.memberCount +
      ' caractère' + (row.memberCount > 1 ? "s" : "") + '">' +
      '<b lang="zh-Hans">' + esc(row.radical) + "</b>" +
      (row.sens ? "<span>" + esc(row.sens) + "</span>" : "") +
      "<small>" + row.memberCount + " caractère" + (row.memberCount > 1 ? "s" : "") + "</small>" +
      "</button>"
   );
}

function renderRadicalGroups() {
   const container = $("radical-groups");
   if (!container) return;
   const catalog = Array.isArray(radicalBrowser.catalog) ? radicalBrowser.catalog : [];
   const filtered = catalog.filter((row) => radicalMatchesFilter(row, radicalBrowser.filter));
   if (!filtered.length) {
      container.innerHTML = '<div class="search-empty"><p>Aucune clé ne correspond.</p></div>';
      return;
   }
   const groups = new Map();
   filtered.forEach((row) => {
      const key = row.strokeCount == null ? "unknown" : row.strokeCount;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
   });
   const orderedKeys = Array.from(groups.keys()).sort((left, right) => {
      if (left === "unknown") return 1;
      if (right === "unknown") return -1;
      return left - right;
   });
   container.innerHTML = orderedKeys
      .map((key) => {
         const rows = groups.get(key);
         return (
            '<section class="radical-group"><h3 class="eyebrow radical-group-heading">' +
            esc(radicalGroupHeading(key === "unknown" ? null : key)) + "</h3>" +
            '<div class="radical-grid">' + rows.map(radicalChipHtml).join("") + "</div></section>"
         );
      })
      .join("");
   container.querySelectorAll("[data-radical]").forEach((button) => {
      button.onclick = () => selectRadical(button.dataset.radical);
   });
}

function renderRadicalTable() {
   const panel = $("dradical-panel");
   if (!panel) return;
   syncRadicalHeader();
   const catalog = Array.isArray(radicalBrowser.catalog) ? radicalBrowser.catalog : [];
   if (!catalog.length) {
      panel.innerHTML =
         '<div class="search-empty error" role="alert"><b>Les clés n’ont pas pu être chargées.</b>' +
         '<button class="btn" id="radical-retry">Réessayer</button></div>';
      if ($("radical-retry")) $("radical-retry").onclick = () => openRadicalMode({ fromHistory: true });
      return;
   }
   const totalCharacters = catalog.reduce((total, row) => total + row.memberCount, 0);
   panel.innerHTML =
      '<div class="radical-toolbar"><input class="radical-filter-input" id="radical-filter" type="search" ' +
      'placeholder="Filtrer les clés (forme, sens, traits)…" value="' + esc(radicalBrowser.filter) +
      '" autocomplete="off" autocapitalize="off" spellcheck="false"></div>' +
      '<div class="radical-summary search-result-summary"><span>' + catalog.length + " clés · " +
      totalCharacters + " caractères</span></div>" +
      '<div class="radical-groups" id="radical-groups"></div>';
   const input = $("radical-filter");
   input.oninput = () => {
      radicalBrowser.filter = input.value;
      renderRadicalGroups();
   };
   renderRadicalGroups();
}

async function resolveRadicalMembers(radical) {
   if (radicalMembersCache.has(radical)) return radicalMembersCache.get(radical);
   const chunk = await loadRadicalCharacters(radical);
   const strokeByHanzi = new Map();
   const wanted = [];
   (chunk.characters || []).forEach((item) => {
      strokeByHanzi.set(item.hanzi, item.strokeCount == null ? null : item.strokeCount);
      wanted.push(item.hanzi);
   });
   const characterIndex = await loadDictionaryIndex("characters");
   const references = [];
   wanted.forEach((hanzi) => {
      const indexed = characterIndex[hanzi];
      if (indexed) references.push(indexed.entryRef);
   });
   const previews = await loadDictionaryPreviewsByReferences(references);
   const entries = previews.map((entry) =>
      Object.assign({}, entry, { __strokeCount: strokeByHanzi.has(entry.simplified) ? strokeByHanzi.get(entry.simplified) : null }),
   );
   radicalMembersCache.set(radical, entries);
   return entries;
}

async function selectRadical(radical, options) {
   const settings = options || {};
   if (!settings.fromHistory && history.state?.moStudioSearch && history.state.mode === "radical")
      history.replaceState(radicalHistoryPayload(history.state.radical), "");
   if (!settings.fromHistory) history.pushState(radicalHistoryPayload(radical), "");
   radicalBrowser.radical = radical;
   radicalBrowser.members = null;
   radicalBrowser.visible = Math.max(RADICAL_PAGE_SIZE, Number(settings.visible) || RADICAL_PAGE_SIZE);
   setRadicalPanelVisible(true);
   if (!settings.fromHistory) window.scrollTo(0, 0);
   const panel = $("dradical-panel");
   if (panel) panel.innerHTML = radicalLoadingHtml("Chargement des caractères…");
   try {
      if (!Array.isArray(radicalBrowser.catalog)) radicalBrowser.catalog = await loadRadicalCatalog();
      syncRadicalHeader();
      radicalBrowser.members = await resolveRadicalMembers(radical);
      if (radicalBrowser.active && radicalBrowser.radical === radical) {
         renderRadicalMembers();
         if (settings.fromHistory)
            requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, Number(settings.scrollY) || 0)));
      }
   } catch (error) {
      renderRadicalMembersError(radical);
   }
}

function openRadicalCharacterDetail(entry) {
   history.replaceState(radicalHistoryPayload(radicalBrowser.radical), "");
   history.pushState(searchHistoryPayload("detail", entry.id), "");
   openSearchDictionaryDetail(entry, false);
}

function renderRadicalMembersError(radical) {
   const panel = $("dradical-panel");
   if (!panel) return;
   panel.innerHTML =
      '<div class="search-empty error radical-members-error" role="alert"><b>Les caractères n’ont pas pu être chargés.</b>' +
      '<p>La clé sélectionnée est conservée. Réessaie quand les données locales sont disponibles.</p>' +
      '<button class="btn" id="radical-retry">Réessayer</button></div>';
   if ($("radical-retry")) $("radical-retry").onclick = () => selectRadical(radical, { fromHistory: true });
}

function renderRadicalMembers() {
   const panel = $("dradical-panel");
   if (!panel) return;
   const entries = Array.isArray(radicalBrowser.members) ? radicalBrowser.members : [];
   syncRadicalHeader(entries.length);
   const visible = entries.slice(0, radicalBrowser.visible);
   const items = visible.map((entry) => ({
      entry,
      rank: {
         explanation:
            entry.__strokeCount != null
               ? entry.__strokeCount + " trait" + (entry.__strokeCount > 1 ? "s" : "")
               : "",
      },
   }));
   panel.innerHTML =
      '<section class="radical-members" aria-labelledby="radical-results-title">' +
      '<header class="radical-members-heading"><div><h3 id="radical-results-title">Caractères utilisant cette clé</h3>' +
      '<p>Triés par nombre de traits croissant.</p></div></header>' +
      (items.map((item, index) => dictionaryResultHtml(item, index)).join("") ||
         '<div class="search-empty radical-members-empty"><p>Aucun caractère associé à cette clé.</p></div>') +
      (radicalBrowser.visible < entries.length
         ? '<div class="search-more"><button class="btn ghost" id="radical-show-more">Afficher plus</button></div>'
         : "") + '</section>';
   panel.querySelectorAll("[data-result-index]").forEach((button) => {
      button.onclick = () => {
         const entry = visible[Number(button.dataset.resultIndex)];
         const displayHanzi = dictionaryResultDisplayHanzi(entry);
         if (displayHanzi !== entry.simplified) entry.__selectedHanzi = displayHanzi;
         openRadicalCharacterDetail(entry);
      };
   });
   if ($("radical-show-more"))
      $("radical-show-more").onclick = () => {
         radicalBrowser.visible += RADICAL_PAGE_SIZE;
         if (history.state?.moStudioSearch && history.state.mode === "radical")
            history.replaceState(radicalHistoryPayload(radicalBrowser.radical), "");
         renderRadicalMembers();
      };
}

function backToRadicalTable(options) {
   const settings = options || {};
   if (
      !settings.fromHistory &&
      history.state &&
      history.state.moStudioSearch &&
      history.state.mode === "radical" &&
      history.state.radical
   ) {
      history.back();
   } else {
      radicalBrowser.radical = null;
      syncRadicalHeader();
      renderRadicalTable();
   }
}

function exitRadicalMode(options) {
   const settings = options || {};
   if (!settings.fromHistory) writeSearchHistory(srch.q ? "results" : "landing", null, false);
   setRadicalPanelVisible(false);
}
