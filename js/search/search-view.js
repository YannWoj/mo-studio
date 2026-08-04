"use strict";

const SEARCH_RECENT_KEY = "mo-studio-dictionary-recent-searches-v1";
const SEARCH_DEBOUNCE_MS = 100;
const SEARCH_PAGE_SIZE = 32;
let searchOutsideHandler = null;
let dsearchTimer = null;
let srch = {
   q: "",
   mode: "landing",
   search: null,
   visible: SEARCH_PAGE_SIZE,
   suggestionSearch: null,
   suggestionIndex: -1,
   scrollY: 0,
   pendingDetailId: null,
};

function readRecentSearches() {
   try {
      const value = JSON.parse(localStorage.getItem(SEARCH_RECENT_KEY) || "[]");
      return Array.isArray(value)
         ? value.filter((item) => typeof item === "string" && item.trim()).slice(0, 8)
         : [];
   } catch (error) {
      return [];
   }
}

function rememberRecentSearch(query) {
   const visible = normalizeVisibleWhitespace(query);
   if (!visible) return;
   const recent = readRecentSearches().filter(
      (item) => normalizeVisibleWhitespace(item).toLowerCase() !== visible.toLowerCase(),
   );
   recent.unshift(visible);
   try {
      localStorage.setItem(SEARCH_RECENT_KEY, JSON.stringify(recent.slice(0, 8)));
   } catch (error) {
      /* Le dictionnaire reste utilisable si le stockage privé est indisponible. */
   }
}

function currentUnit() {
   const pool = db.cards.filter((card) => !card.acquired && card.unit != null);
   const fresh = pool.filter((card) => card.due == null).sort(unitSort);
   if (fresh.length) return fresh[0].unit;
   const any = pool.sort(unitSort);
   return any.length ? any[0].unit : null;
}

function continuingCards() {
   const unit = currentUnit();
   const candidates = unit == null ? db.cards : db.cards.filter((card) => card.unit === unit);
   return candidates.slice().sort(unitSort).slice(0, 6);
}

function searchLandingHtml() {
   const recent = readRecentSearches();
   const cards = continuingCards();
   return (
      '<div class="search-examples" aria-label="Exemples de recherche">' +
      ["你", "ni3", "nǐ", "bonjour", "红绿蓝黑白灰棕"]
         .map((value) => '<button class="chip" data-search-example="' + esc(value) + '">' + esc(value) + "</button>")
         .join("") +
      "</div>" +
      (recent.length
         ? '<section class="search-landing-section"><div class="eyebrow">Recherches récentes</div><div class="chips">' +
           recent.map((value) => '<button class="chip" data-recent-search="' + esc(value) + '">' + esc(value) + "</button>").join("") +
           "</div></section>"
         : "") +
      (cards.length
         ? '<section class="search-landing-section"><div class="eyebrow">Continuer avec Mes mots</div><div class="search-card-strip">' +
           cards
              .map(
                 (card) =>
                    '<button class="search-card-chip" data-card-id="' + esc(card.id) + '"><b>' + esc(card.hz) +
                    "</b><span>" + esc(card.fr) + "</span></button>",
              )
              .join("") +
           "</div></section>"
         : "") +
      '<p class="sh-note">Les niveaux HSK et les fréquences ne sont affichés que lorsqu’une source vérifiée les fournit.</p>'
   );
}

function wireSearchLanding() {
   document.querySelectorAll("[data-search-example], [data-recent-search]").forEach((button) => {
      button.onclick = () => launchDictionarySearch(button.dataset.searchExample || button.dataset.recentSearch);
   });
   document.querySelectorAll("[data-card-id]").forEach((button) => {
      button.onclick = () => {
         const card = db.cards.find((item) => item.id === button.dataset.cardId);
         if (card) openSearchDictionaryDetail(personalCardAsDictionaryEntry(card), true);
      };
   });
}

function dictionaryEntryPinyinText(entry) {
   return uniqueDetailValues((entry.pinyin || []).map((variant) => variant.marked).filter(Boolean)).join(" · ");
}

function dictionaryResultDefinition(entry) {
   if (entry.definitionsFr && entry.definitionsFr.length)
      return { text: entry.definitionsFr[0], english: false };
   if (entry.definitionsEn && entry.definitionsEn.length)
      return { text: entry.definitionsEn[0], english: true };
   return { text: "Définition indisponible", english: false };
}

function verifiedResultHskBadge(entry) {
   const verified = verifiedHskLevels(entry);
   if (verified.length)
      return verified
         .map(
            (level) =>
               '<i class="b hsk-badge hsk-level-' +
               level +
               '" data-hsk-badge="' +
               level +
               '">HSK ' +
               esc(level) +
               "</i>",
         )
         .join("");
   if (entry.hskLegacy && entry.hskLegacy.length)
      return '<i class="b u">HSK ' + esc(entry.hskLegacy[0]) + "</i>";
   if (entry.hsk30 && entry.hsk30.length)
      return '<i class="b u">HSK 3.0 · ' + esc(entry.hsk30[0]) + "</i>";
   return "";
}

function dictionaryResultHtml(item, index) {
   const entry = item.entry;
   const definition = dictionaryResultDefinition(entry);
   const traditional = entry.traditional !== entry.simplified ? entry.traditional : "";
   return (
      '<button class="dict-result" data-result-index="' + index + '" data-entry-id="' + esc(entry.id) + '">' +
      '<span class="dict-result-hanzi"><b>' + esc(entry.simplified) + "</b>" +
      (traditional ? '<small>繁 · ' + esc(traditional) + "</small>" : "") +
      "</span>" +
      '<span class="dict-result-main"><span class="row-py">' + colorPinyin(dictionaryEntryPinyinText(entry)) + "</span>" +
      '<span class="row-fr' + (definition.english ? " english" : "") + '">' +
      (definition.english ? "EN · " : "") + esc(definition.text) + "</span>" +
      '<small class="dict-match">' + esc(item.rank.explanation) + "</small></span>" +
      '<span class="row-badges"><i class="b u">' +
      (entry.entryType === "character" ? "caractère" : "mot") +
      "</i>" + verifiedResultHskBadge(entry) +
      (entry.__hskSource
         ? '<i class="b hsk-source-status">' +
           esc(hskLinkStatusLabel(entry.dictionaryLinkStatus)) +
           "</i>"
         : "") +
      (entry.personalCard ? '<i class="b jade">Mes mots</i>' : "") +
      (Number.isFinite(entry.frequencyRank) ? '<i class="b u">fréq. ' + esc(entry.frequencyRank) + "</i>" : "") +
      "</span></button>"
   );
}

function renderDictionaryResults() {
   const box = $("dresults");
   if (!box) return;
   const response = srch.search;
   if (!response) {
      box.innerHTML = searchLandingHtml();
      wireSearchLanding();
      return;
   }
   if (!response.query.valid) {
      box.innerHTML =
         '<div class="search-empty"><b>Recherche non reconnue</b><p>Utilise des caractères chinois, du pinyin ou des mots français.</p></div>';
      return;
   }
   const visible = response.results.slice(0, srch.visible);
   const sequence = response.query.type === "hanzi-sequence" && response.query.characters.length > 1;
   box.innerHTML =
      (sequence
         ? '<button class="btn wide" id="btn-seq">Voir les ' + response.query.characters.length + " caractères un par un →</button>"
         : "") +
      '<div class="search-result-summary"><span>' +
      (response.results.length
         ? response.results.length + (response.limited ? " premiers" : "") + " résultat" + (response.results.length > 1 ? "s" : "")
         : "Aucun résultat") +
      "</span>" +
      (response.englishFallback ? '<span class="search-fallback">Repli anglais</span>' : "") +
      "</div>" +
      (visible.map(dictionaryResultHtml).join("") ||
         '<div class="search-empty"><p>Aucune correspondance vérifiée.</p></div>') +
      (srch.visible < response.results.length
         ? '<div class="search-more"><button class="btn ghost" id="dshow-more">Afficher plus</button></div>'
         : "");
   box.querySelectorAll("[data-result-index]").forEach((button) => {
      button.onclick = () => openSearchDictionaryDetail(response.results[Number(button.dataset.resultIndex)].entry, true);
   });
   if ($("dshow-more"))
      $("dshow-more").onclick = () => {
         srch.visible += SEARCH_PAGE_SIZE;
         renderDictionaryResults();
      };
   if ($("btn-seq")) $("btn-seq").onclick = () => openSequence(response.query.characters);
}

function renderSearchSuggestions(response) {
   const target = $("dsearch-suggestions");
   const input = $("dq");
   if (!target) return;
   const items = response && response.results ? response.results.slice(0, 6) : [];
   srch.suggestionSearch = response;
   srch.suggestionIndex = -1;
   if (!items.length) {
      target.hidden = true;
      target.innerHTML = "";
      if (input) input.setAttribute("aria-expanded", "false");
      return;
   }
   target.innerHTML = items
      .map((item, index) => {
         const definition = dictionaryResultDefinition(item.entry);
         return (
            '<button id="dsearch-option-' + index + '" role="option" aria-selected="false" data-suggestion-index="' + index + '"><b>' +
            esc(item.entry.simplified) + '</b><span>' + colorPinyin(dictionaryEntryPinyinText(item.entry)) +
            '</span><small>' + (item.entry.entryType === "character" ? "caractère" : "mot") +
            " · " + (definition.english ? "EN · " : "") + esc(definition.text) + "</small></button>"
         );
      })
      .join("");
   target.hidden = false;
   if (input) input.setAttribute("aria-expanded", "true");
   target.querySelectorAll("[data-suggestion-index]").forEach((button) => {
      button.onclick = () => {
         const entry = items[Number(button.dataset.suggestionIndex)].entry;
         launchDictionarySearch(entry.simplified);
      };
   });
}

function moveSearchSuggestion(direction) {
   const target = $("dsearch-suggestions");
   const options = target ? Array.from(target.querySelectorAll("[data-suggestion-index]")) : [];
   if (!options.length) return false;
   srch.suggestionIndex = (srch.suggestionIndex + direction + options.length) % options.length;
   options.forEach((option, index) => option.setAttribute("aria-selected", String(index === srch.suggestionIndex)));
   if ($("dq")) $("dq").setAttribute("aria-activedescendant", options[srch.suggestionIndex].id);
   options[srch.suggestionIndex].scrollIntoView({ block: "nearest" });
   return true;
}

function closeSearchSuggestions() {
   const target = $("dsearch-suggestions");
   if (target) target.hidden = true;
   if ($("dq")) {
      $("dq").setAttribute("aria-expanded", "false");
      $("dq").removeAttribute("aria-activedescendant");
   }
   srch.suggestionIndex = -1;
}

function cleanupSearchView() {
   clearTimeout(dsearchTimer);
   dsearchTimer = null;
   if (searchOutsideHandler) {
      document.removeEventListener("pointerdown", searchOutsideHandler);
      searchOutsideHandler = null;
   }
}

async function updateSearchSuggestions() {
   const input = $("dq");
   if (!input) return;
   srch.q = input.value;
   $("dq-clear").hidden = !input.value;
   const query = classifySearchQuery(input.value);
   if (!query.valid) return closeSearchSuggestions();
   const expected = input.value;
   $("dsearch-state").textContent = "Préparation du dictionnaire…";
   try {
      const response = await searchDictionary(expected, { limit: 6, candidateLimit: 18 });
      if (!$("dq") || $("dq").value !== expected) return;
      renderSearchSuggestions(response);
      $("dsearch-state").textContent = "";
   } catch (error) {
      if (error instanceof StaleDictionarySearchError) return;
      if ($("dsearch-state")) $("dsearch-state").textContent = "Dictionnaire indisponible.";
   }
}

function searchHistoryPayload(mode, entryId) {
   return {
      moStudioSearch: true,
      mode,
      q: srch.q,
      entryId: entryId || null,
      scrollY: mode === "detail" ? window.scrollY : srch.scrollY || 0,
   };
}

function writeSearchHistory(mode, entryId, replace) {
   const payload = searchHistoryPayload(mode, entryId);
   if (replace) history.replaceState(payload, "");
   else history.pushState(payload, "");
}

async function launchDictionarySearch(value, options) {
   const settings = options || {};
   clearTimeout(dsearchTimer);
   dsearchTimer = null;
   const input = $("dq");
   srch.q = value != null ? String(value) : input ? input.value : srch.q;
   srch.mode = "results";
   srch.visible = SEARCH_PAGE_SIZE;
   srch.search = null;
   closeSearchSuggestions();
   if (input) input.value = srch.q;
   if (!settings.fromHistory) writeSearchHistory("results", null, false);
   const box = $("dresults");
   if (box)
      box.innerHTML = '<div class="dictionary-loading" role="status" aria-live="polite"><span class="ink-loader" aria-hidden="true"></span><b>Préparation du dictionnaire…</b><span id="dictionary-loading-detail">Chargement de l’index nécessaire.</span></div>';
   const statusTarget = () => $("dictionary-loading-detail");
   try {
      const response = await searchDictionary(srch.q, {
         limit: SEARCH_RESULT_LIMIT,
         onStatus: (message) => {
            const target = statusTarget();
            if (target) target.textContent = message;
         },
      });
      try {
         await mergeHskSearchResults(response, srch.q);
      } catch (hskError) {
         response.hskError = hskError.message;
      }
      srch.search = response;
      srch.mode = "results";
      if (response.query.valid) rememberRecentSearch(srch.q);
      renderDictionaryResults();
      requestAnimationFrame(() => window.scrollTo(0, settings.scrollY || 0));
      if (srch.pendingDetailId) {
         const entryId = srch.pendingDetailId;
         srch.pendingDetailId = null;
          const entry = await loadHskSearchDetailEntry(entryId);
         if (entry) openSearchDictionaryDetail(entry, false);
      }
   } catch (error) {
      if (error instanceof StaleDictionarySearchError) return;
      if (box)
         box.innerHTML =
            '<div class="search-empty error" role="alert"><b>Le dictionnaire n’a pas pu être chargé.</b><p>' +
            esc(error.message) + '</p><button class="btn" id="dsearch-retry">Réessayer</button></div>';
      if ($("dsearch-retry")) $("dsearch-retry").onclick = () => launchDictionarySearch(srch.q, { fromHistory: true });
   }
}

async function openSearchDictionaryDetail(entry, pushHistory) {
   srch.scrollY = window.scrollY;
   if (pushHistory) {
      writeSearchHistory("results", null, true);
      writeSearchHistory("detail", entry.id, false);
   }
   srch.mode = "detail";
   if (entry.__preview) {
      openSheet(
         '<div class="dictionary-loading"><span class="ink-loader"></span><b>Chargement de la fiche complète…</b></div>',
      );
      try {
         entry = (await loadHskSearchDetailEntry(entry.id)) || entry;
      } catch (error) {
         closeSheet();
         toast("Fiche détaillée indisponible hors ligne.");
         return;
      }
   }
   openDictDetail(attachHskMetadata(entry), { fromSearch: true });
}

function closeSearchDictionaryDetail() {
   if (history.state && history.state.moStudioSearch && history.state.mode === "detail")
      history.back();
   else {
      closeSheet();
      srch.mode = "results";
      requestAnimationFrame(() => window.scrollTo(0, srch.scrollY || 0));
   }
}

function restoreSearchHistory(state) {
   cancelDictionarySearches();
   closeSheet();
   activeView = "search";
   srch.q = state.q || "";
   srch.mode = state.mode || (srch.q ? "results" : "landing");
   srch.scrollY = Number(state.scrollY) || 0;
   srch.pendingDetailId = state.mode === "detail" ? state.entryId : null;
   document.querySelectorAll(".nav button").forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.view === "search")),
   );
   if (state.mode === "sequence") {
      openSequence(Array.from(state.characters || ""), {
         fromHistory: true,
         index: state.sequenceIndex,
         strokeTab: state.strokeTab,
      });
      return;
   }
   renderSearch();
   if (srch.mode === "landing") return;
   if (srch.search && srch.search.query.display === normalizeVisibleWhitespace(srch.q)) {
      renderDictionaryResults();
      requestAnimationFrame(() => window.scrollTo(0, srch.scrollY));
      if (srch.pendingDetailId)
         loadHskSearchDetailEntry(srch.pendingDetailId).then((entry) => {
            srch.pendingDetailId = null;
            if (entry) openSearchDictionaryDetail(entry, false);
         });
   } else launchDictionarySearch(srch.q, { fromHistory: true, scrollY: srch.scrollY });
}

function renderSearch() {
   document.body.classList.remove("in-seq");
   const root = $("view");
   root.innerHTML =
      '<section class="card pad search-page"><header class="search-hero"><h2 class="v-t">查 · Rechercher</h2>' +
      '<p class="muted">Trouve un caractère, un mot, un pinyin ou une traduction.</p></header>' +
      '<form class="dictionary-search-form" id="dsearch-form"><div class="dictionary-search-input">' +
      '<input class="search" id="dq" placeholder="汉字, pinyin ou français…" value="' + esc(srch.q) +
      '" autocomplete="off" autocapitalize="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="dsearch-suggestions" aria-expanded="false">' +
      '<button type="button" class="search-clear" id="dq-clear" aria-label="Effacer"' + (srch.q ? "" : " hidden") + '>×</button>' +
      '<div class="dictionary-suggestions" id="dsearch-suggestions" role="listbox" hidden></div></div>' +
      '<button class="btn primary search-submit" type="submit">Rechercher</button></form>' +
      '<div class="search-live-state" id="dsearch-state" role="status" aria-live="polite"></div>' +
      '<div id="dresults"></div></section>';

   const input = $("dq");
   $("dsearch-form").onsubmit = (event) => {
      event.preventDefault();
      if (srch.suggestionIndex >= 0 && srch.suggestionSearch) {
         const item = srch.suggestionSearch.results[srch.suggestionIndex];
         if (item) return launchDictionarySearch(item.entry.simplified);
      }
      launchDictionarySearch(input.value);
   };
   input.oninput = () => {
      srch.q = input.value;
      clearTimeout(dsearchTimer);
      dsearchTimer = setTimeout(updateSearchSuggestions, SEARCH_DEBOUNCE_MS);
      $("dq-clear").hidden = !input.value;
   };
   input.onkeydown = (event) => {
      if (event.key === "ArrowDown" && moveSearchSuggestion(1)) event.preventDefault();
      else if (event.key === "ArrowUp" && moveSearchSuggestion(-1)) event.preventDefault();
      else if (event.key === "Escape") closeSearchSuggestions();
   };
   input.onfocus = () => {
      if (srch.suggestionSearch && srch.suggestionSearch.results.length) {
         $("dsearch-suggestions").hidden = false;
         input.setAttribute("aria-expanded", "true");
      }
   };
   $("dq-clear").onclick = () => {
      cancelDictionarySearches();
      input.value = "";
      srch.q = "";
      srch.mode = "landing";
      srch.search = null;
      $("dq-clear").hidden = true;
      closeSearchSuggestions();
      renderDictionaryResults();
      input.focus();
   };
   if (searchOutsideHandler) document.removeEventListener("pointerdown", searchOutsideHandler);
   searchOutsideHandler = (event) => {
      if (!event.target.closest(".dictionary-search-input")) closeSearchSuggestions();
   };
   document.addEventListener("pointerdown", searchOutsideHandler);

   if (["results", "detail"].includes(srch.mode) && srch.search) renderDictionaryResults();
   else if (["results", "detail"].includes(srch.mode) && srch.q)
      launchDictionarySearch(srch.q, { fromHistory: true, scrollY: srch.scrollY });
   else {
      srch.mode = "landing";
      srch.search = null;
      renderDictionaryResults();
   }
}
