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
      scrollY: window.scrollY,
   };
}

function setRadicalPanelVisible(active) {
   radicalBrowser.active = active;
   const normal = $("dsearch-normal");
   const panel = $("dradical-panel");
   if (normal) normal.hidden = active;
   if (panel) panel.hidden = !active;
   const toggle = $("search-mode-toggle");
   if (toggle) toggle.setAttribute("aria-pressed", String(active));
}

function radicalLoadingHtml(label) {
   return (
      '<div class="dictionary-loading" role="status" aria-live="polite"><span class="ink-loader" aria-hidden="true"></span><b>' +
      esc(label || "Chargement des clés…") + "</b></div>"
   );
}

async function openRadicalMode(options) {
   const settings = options || {};
   setRadicalPanelVisible(true);
   if (!settings.fromHistory) history.pushState(radicalHistoryPayload(null), "");
   radicalBrowser.radical = null;
   radicalBrowser.filter = "";
   const panel = $("dradical-panel");
   if (panel) panel.innerHTML = radicalLoadingHtml();
   try {
      radicalBrowser.catalog = await loadRadicalCatalog();
   } catch (error) {
      radicalBrowser.catalog = [];
   }
   if (radicalBrowser.active && !radicalBrowser.radical) renderRadicalTable();
}

function radicalGroupHeading(strokeCount) {
   if (strokeCount == null) return "Nombre de traits inconnu";
   return strokeCount + " trait" + (strokeCount > 1 ? "s" : "");
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
   setRadicalPanelVisible(true);
   if (!settings.fromHistory) history.pushState(radicalHistoryPayload(radical), "");
   radicalBrowser.radical = radical;
   radicalBrowser.visible = RADICAL_PAGE_SIZE;
   const panel = $("dradical-panel");
   if (panel) panel.innerHTML = radicalLoadingHtml("Chargement des caractères…");
   try {
      radicalBrowser.members = await resolveRadicalMembers(radical);
      if (radicalBrowser.active && radicalBrowser.radical === radical) renderRadicalMembers();
   } catch (error) {
      if (panel)
         panel.innerHTML =
            '<div class="search-empty error" role="alert"><b>Les caractères n’ont pas pu être chargés.</b>' +
            '<button class="btn" id="radical-retry">Réessayer</button></div>';
      if ($("radical-retry")) $("radical-retry").onclick = () => selectRadical(radical, { fromHistory: true });
   }
}

function openRadicalCharacterDetail(entry) {
   history.replaceState(radicalHistoryPayload(radicalBrowser.radical), "");
   history.pushState(searchHistoryPayload("detail", entry.id), "");
   openSearchDictionaryDetail(entry, false);
}

function renderRadicalMembers() {
   const panel = $("dradical-panel");
   if (!panel) return;
   const entries = Array.isArray(radicalBrowser.members) ? radicalBrowser.members : [];
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
      '<button type="button" class="btn ghost radical-back" id="radical-back">← Retour aux clés</button>' +
      '<div class="radical-summary search-result-summary"><span>' + entries.length + " caractère" +
      (entries.length > 1 ? "s" : "") + " pour la clé " + esc(radicalBrowser.radical) + "</span></div>" +
      (items.map((item, index) => dictionaryResultHtml(item, index)).join("") ||
         '<div class="search-empty"><p>Aucun caractère.</p></div>') +
      (radicalBrowser.visible < entries.length
         ? '<div class="search-more"><button class="btn ghost" id="radical-show-more">Afficher plus</button></div>'
         : "");
   $("radical-back").onclick = () => backToRadicalTable();
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
      renderRadicalTable();
   }
}

function exitRadicalMode(options) {
   const settings = options || {};
   if (!settings.fromHistory) writeSearchHistory(srch.q ? "results" : "landing", null, false);
   setRadicalPanelVisible(false);
}
