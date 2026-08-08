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
      return { text: entry.definitionsFr[0], english: false, unavailable: false };
   if (entry.definitionsEn && entry.definitionsEn.length)
      return { text: "Traduction française indisponible", english: true, englishText: entry.definitionsEn[0], unavailable: true };
   return { text: "Traduction française indisponible", english: false, unavailable: true };
}

function dictionaryEntryDetailedTypeLabels(entry) {
   const definitions = [...(entry.definitionsFr || []), ...(entry.definitionsEn || [])].join(" ");
   const parts = (entry.hskVerified || []).map((item) => item.partOfSpeech || "").join("、");
   const labels = [];
   if (dictionaryVariantStatus(entry) !== "modern") labels.push("variante");
   if (/classifier|classificateur|measure word|\bCL:/iu.test(definitions + " " + parts)) labels.push("classificateur");
   if (/suffix|suffixe/iu.test(definitions + " " + parts)) labels.push("suffixe");
   if (/proper noun|surname|nom propre/iu.test(definitions + " " + parts)) labels.push("nom");
   if (/\bverb\b|verbe|动词|動詞/iu.test(parts)) labels.push("verbe");
   if (/\bnoun\b|\bnom\b|名词|名詞/iu.test(parts)) labels.push("nom");
   const structural = (entry.visualEntryTypes || []).includes("word") || entry.entryType === "word"
      ? "mot"
      : entry.entryType === "character" ? "caractère" : "mot";
   return Array.from(new Set([structural, ...labels]));
}

function dictionaryEntryTypeLabels(entry) {
   if (dictionaryVariantStatus(entry) !== "modern") return ["Variante"];
   if ((entry.visualEntryTypes || []).includes("word") || entry.entryType === "word") return ["Mot"];
   return ["Caractère"];
}

function verifiedResultHskBadge(entry) {
   const verified = verifiedHskLevels(entry);
   if (verified.length)
      return '<i class="b hsk-badge hsk-level-' + verified[0] + '" data-hsk-badge="' +
         esc(verified.join(" ")) + '">HSK ' + verified.map(esc).join(" · ") + "</i>";
   if (entry.hskLegacy && entry.hskLegacy.length)
      return '<i class="b u">HSK ' + esc(entry.hskLegacy[0]) + "</i>";
   if (entry.hsk30 && entry.hsk30.length)
      return '<i class="b u">HSK 3.0 · ' + esc(entry.hsk30[0]) + "</i>";
   return "";
}

function dictionaryResultDisplayHanzi(entry) {
   const query = srch.search && srch.search.query;
   if (
      query && query.type && query.type.startsWith("hanzi") &&
      query.hanzi === entry.traditional && entry.traditional !== entry.simplified
   ) return entry.traditional;
   if (entry.__selectedHanzi) return entry.__selectedHanzi;
   if (dictionaryVariantStatus(entry) !== "modern" && entry.traditional !== entry.simplified)
      return entry.traditional;
   return entry.simplified;
}

function dictionaryResultBadgesHtml(entry) {
   const badges = dictionaryEntryTypeLabels(entry)
      .map((label) => '<i class="b u">' + esc(label) + "</i>");
   const hsk = verifiedResultHskBadge(entry);
   if (hsk) badges.push(hsk);
   if (entry.personalCard) badges.push('<i class="b jade">Mes mots</i>');
   return badges.slice(0, entry.personalCard ? 3 : 2).join("");
}

function dictionaryResultVariantsHtml(entry, resultIndex) {
   const variants = Array.isArray(entry.visualVariants) ? entry.visualVariants : [];
   if (!variants.length) return "";
   const allTraditional = variants.every((variant) => variant.traditional !== variant.simplified);
   const label = variants.length + " variante" + (variants.length > 1 ? "s" : "") +
      (allTraditional ? " traditionnelle" + (variants.length > 1 ? "s" : "") : " graphique" + (variants.length > 1 ? "s" : ""));
   return '<details class="dict-result-variants"><summary>' + esc(label) +
      '</summary><div class="dict-result-variant-list">' +
      variants.map((variant, variantIndex) => {
         const form = variant.traditional || variant.simplified;
         return '<button class="dict-result-variant" type="button" data-result-variant="' +
            resultIndex + ':' + variantIndex + '" aria-label="Ouvrir la fiche exacte de ' + esc(form) +
            '"><b>' + esc(form) + '</b><span>→ ' + esc(variant.simplified) + ' · ' +
            colorPinyin(dictionaryEntryPinyinText(variant)) + '</span></button>';
      }).join("") + "</div></details>";
}

function dictionaryResultHtml(item, index) {
   const entry = item.entry;
   const definition = dictionaryResultDefinition(entry);
   const displayHanzi = dictionaryResultDisplayHanzi(entry);
   const traditional = entry.traditional !== entry.simplified && entry.traditional !== displayHanzi ? entry.traditional : "";
   return (
      '<article class="dict-result" data-entry-id="' + esc(entry.id) + '"><button class="dict-result-primary" type="button" data-result-index="' + index + '">' +
      '<span class="dict-result-hanzi"><b>' + esc(displayHanzi) + "</b>" +
      (traditional ? '<small>' + (dictionaryVariantStatus(entry) !== "modern" ? "Variante traditionnelle" : "Traditionnel") + ' · ' + esc(traditional) + "</small>" : "") +
      "</span>" +
      '<span class="dict-result-main"><span class="row-py">' + colorPinyin(dictionaryEntryPinyinText(entry)) + "</span>" +
      '<span class="row-fr' + (definition.english ? " english" : "") + '">' +
      esc(definition.text) + "</span>" +
      (definition.englishText ? '<small class="dict-english-reference">Sens anglais de référence · ' + esc(definition.englishText) + "</small>" : "") +
      '<small class="dict-match">' + esc(item.rank.explanation) +
      '</small><span class="dict-result-meta" aria-label="Métadonnées">' +
      dictionaryResultBadgesHtml(entry) + "</span></span></button>" +
      dictionaryResultVariantsHtml(entry, index) + "</article>"
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
      button.onclick = () => {
         const entry = response.results[Number(button.dataset.resultIndex)].entry;
         const displayHanzi = dictionaryResultDisplayHanzi(entry);
         if (displayHanzi !== entry.simplified) entry.__selectedHanzi = displayHanzi;
         openSearchDictionaryDetail(entry, true);
      };
   });
   box.querySelectorAll("[data-result-variant]").forEach((button) => {
      button.onclick = () => {
         const [resultIndex, variantIndex] = button.dataset.resultVariant.split(":").map(Number);
         const variant = response.results[resultIndex]?.entry.visualVariants?.[variantIndex];
         if (!variant) return;
         openSearchDictionaryDetail({
            ...variant,
            __selectedHanzi: variant.traditional || variant.simplified,
         }, true);
      };
   });
   if ($("dshow-more"))
      $("dshow-more").onclick = () => {
         srch.visible += SEARCH_PAGE_SIZE;
         renderDictionaryResults();
      };
   if ($("btn-seq")) $("btn-seq").onclick = () => openSequence(response.query.characters);
}

function searchSuggestionConfig(options) {
   const settings = options || {};
   const resolveElement = (value, fallbackId) =>
      value && value.nodeType === 1 ? value : $(value || fallbackId);
   return {
      target: resolveElement(settings.target, "dsearch-suggestions"),
      input: resolveElement(settings.input, "dq"),
      state: settings.state || srch,
      idPrefix: settings.idPrefix || "dsearch-option",
      limit: Number.isFinite(settings.limit) ? settings.limit : 6,
      onSelect: settings.onSelect,
      isAlreadyPersonal: settings.isAlreadyPersonal,
      emptyHtml: settings.emptyHtml || "",
   };
}

function renderSearchSuggestions(response, options) {
   const config = searchSuggestionConfig(options);
   const { target, input, state } = config;
   if (!target) return;
   const items = response && response.results ? response.results.slice(0, config.limit) : [];
   state.suggestionSearch = response;
   state.suggestionIndex = -1;
   if (!items.length) {
      target.hidden = !config.emptyHtml;
      target.innerHTML = config.emptyHtml;
      if (input) input.setAttribute("aria-expanded", String(!!config.emptyHtml));
      return items;
   }
   target.innerHTML = items
      .map((item, index) => {
         const definition = dictionaryResultDefinition(item.entry);
         const alreadyPersonal = config.isAlreadyPersonal
            ? config.isAlreadyPersonal(item.entry)
            : !!item.entry.personalCard;
         return (
            '<button id="' + esc(config.idPrefix) + "-" + index + '" role="option" aria-selected="false" data-suggestion-index="' + index + '"><b>' +
            esc(item.entry.simplified) + '</b><span>' + colorPinyin(dictionaryEntryPinyinText(item.entry)) +
            '</span><small>' + (item.entry.entryType === "character" ? "caractère" : "mot") +
            " · " + (definition.english ? "EN · " : "") + esc(definition.text) +
            (alreadyPersonal ? '<em class="dictionary-suggestion-personal">Déjà dans Mes mots</em>' : "") +
            "</small></button>"
         );
      })
      .join("");
   target.hidden = false;
   if (input) input.setAttribute("aria-expanded", "true");
   target.querySelectorAll("[data-suggestion-index]").forEach((button) => {
      button.onclick = () => {
         const entry = items[Number(button.dataset.suggestionIndex)].entry;
         if (config.onSelect) config.onSelect(entry);
         else launchDictionarySearch(entry.simplified);
      };
   });
   return items;
}

function moveSearchSuggestion(direction, options) {
   const config = searchSuggestionConfig(options);
   const { target, input, state } = config;
   const optionElements = target ? Array.from(target.querySelectorAll("[data-suggestion-index]")) : [];
   if (!optionElements.length) return false;
   state.suggestionIndex = (state.suggestionIndex + direction + optionElements.length) % optionElements.length;
   optionElements.forEach((option, index) => option.setAttribute("aria-selected", String(index === state.suggestionIndex)));
   if (input) input.setAttribute("aria-activedescendant", optionElements[state.suggestionIndex].id);
   optionElements[state.suggestionIndex].scrollIntoView({ block: "nearest" });
   return true;
}

function closeSearchSuggestions(options) {
   const config = searchSuggestionConfig(options);
   const { target, input, state } = config;
   if (target) target.hidden = true;
   if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
   }
   state.suggestionIndex = -1;
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
      mergeDictionaryVisualResults(response);
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
   const selectedHanzi = entry.__selectedHanzi || "";
   const visualGroup = Array.isArray(entry.visualGroup) ? entry.visualGroup.slice() : [];
   if (entry.__preview) {
      openSheet(
         '<div class="dictionary-loading"><span class="ink-loader"></span><b>Chargement de la fiche complète…</b></div>',
      );
      try {
         entry = (await loadHskSearchDetailEntry(entry.id)) || entry;
         if (selectedHanzi) entry.__selectedHanzi = selectedHanzi;
         if (visualGroup.length > 1) {
            const grouped = (await Promise.all(
               visualGroup.filter((id) => id !== entry.id).map((id) => loadHskSearchDetailEntry(id)),
            )).filter(Boolean);
            const primaryMeanings = new Set(
               [...(entry.definitionsFr || []), ...(entry.definitionsEn || [])].map(normalizeTranslation),
            );
            if (!(entry.definitionsFr || []).length) {
               entry.definitionsFr = grouped
                  .flatMap((item) => item.definitionsFr || [])
                  .filter((definition) => primaryMeanings.has(normalizeTranslation(definition)));
            }
            entry.sources = Array.from(new Set([...(entry.sources || []), ...grouped.flatMap((item) => item.sources || [])]));
            entry.sourceRefs = [...(entry.sourceRefs || []), ...grouped.flatMap((item) => item.sourceRefs || [])];
            entry.visualGroup = visualGroup;
            entry.visualEntryTypes = Array.from(new Set([entry.entryType, ...grouped.map((item) => item.entryType)]));
         }
      } catch (error) {
         closeSheet();
         toast("Fiche détaillée indisponible hors ligne.");
         return;
      }
   }
   try {
      entry = await dictionaryEntryWithFrenchSibling(entry);
   } catch (error) {
      /* La fiche conserve son repli anglais si la résolution sœur échoue hors ligne. */
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
   if (state.mode === "radical") {
      srch.mode = srch.q ? "results" : "landing";
      renderSearch();
      if (state.radical) selectRadical(state.radical, { fromHistory: true });
      else openRadicalMode({ fromHistory: true });
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
   radicalBrowser.active = false;
   radicalBrowser.radical = null;
   const root = $("view");
   root.innerHTML =
      '<section class="card pad search-page"><header class="search-hero"><h2 class="v-t">查 · Rechercher</h2>' +
      '<p class="muted">Trouve un caractère, un mot, un pinyin ou une traduction.</p>' +
      '<div class="search-mode-bar"><button type="button" class="chip search-mode-toggle" id="search-mode-toggle" aria-pressed="false">' +
      '<b lang="zh-Hans">部</b> Clés</button></div></header>' +
      '<div id="dsearch-normal">' +
      '<form class="dictionary-search-form" id="dsearch-form"><div class="dictionary-search-input">' +
      '<input class="search" id="dq" placeholder="汉字, pinyin ou français…" value="' + esc(srch.q) +
      '" autocomplete="off" autocapitalize="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="dsearch-suggestions" aria-expanded="false">' +
      '<button type="button" class="search-clear" id="dq-clear" aria-label="Effacer"' + (srch.q ? "" : " hidden") + '>×</button>' +
      '<div class="dictionary-suggestions" id="dsearch-suggestions" role="listbox" hidden></div></div>' +
      '<button class="btn primary search-submit" type="submit">Rechercher</button></form>' +
      '<div class="search-live-state" id="dsearch-state" role="status" aria-live="polite"></div>' +
      '<div id="dresults"></div></div>' +
      '<div id="dradical-panel" hidden></div></section>';

   $("search-mode-toggle").onclick = () => {
      if (radicalBrowser.active) exitRadicalMode();
      else openRadicalMode();
   };

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
