"use strict";

/* ================= Réviser : sélection compacte ================= */
let reviewSelectionMode = "due";
let reviewPackId = "";
let reviewPackIds = new Set();
let reviewCategoryPackId = "";
let reviewCategoryIds = new Set();
let manualReviewIds = new Set();
let reviewScopeLabel = "Mots sélectionnés";
let reviewOptionsOpen = false;
let reviewMode = "cards";
let reviewExtraFilters = {
   newOnly: false,
   favoritesOnly: false,
   difficultOnly: false,
   includeLearned: false,
};

// Conservé pour les modules historiques qui consultent encore cet état.
let hub = { flt: "due", pack: "", cat: "", includeAcquired: false, freeOpen: false };

function baseReviewCards() {
   if (reviewSelectionMode === "all") return db.cards.slice();
   if (reviewSelectionMode === "due") return db.cards.filter(isDue);
   if (reviewSelectionMode === "pack") {
      const selectedPackIds = reviewPackIds.size
         ? Array.from(reviewPackIds)
         : reviewPackId
           ? [reviewPackId]
           : [];
      const ids = new Set(selectedPackIds.flatMap(packCardIds));
      return db.cards.filter((card) => ids.has(card.id));
   }
   if (reviewSelectionMode === "category") {
      const ids = new Set(Array.from(reviewCategoryIds).flatMap(categoryCardIds));
      return db.cards.filter((card) => ids.has(card.id));
   }
   if (reviewSelectionMode === "manual") return db.cards.filter((card) => manualReviewIds.has(card.id));
   return [];
}

function reviewSelectedCards() {
   let cards = baseReviewCards();
   if (!reviewExtraFilters.includeLearned)
      cards = cards.filter((card) => !card.acquired);
   if (reviewExtraFilters.newOnly)
      cards = cards.filter((card) => card.due == null && !card.acquired);
   if (reviewExtraFilters.favoritesOnly)
      cards = cards.filter((card) => card.fav);
   if (reviewExtraFilters.difficultOnly)
      cards = cards.filter((card) => card.difficult);
   return cards;
}

function scopeCards() {
   return reviewSelectedCards();
}

function scopeLabel() {
   if (reviewSelectionMode === "pack") {
      const packs = Array.from(reviewPackIds)
         .map((id) => db.packs.find((pack) => pack.id === id))
         .filter(Boolean);
      if (packs.length === 1) return "Pack · " + packs[0].name;
      return packs.length + " packs";
   }
   if (reviewSelectionMode === "category") {
      const categories = Array.from(reviewCategoryIds).map(categoryById).filter(Boolean);
      const pack = db.packs.find((item) => item.id === reviewCategoryPackId);
      if (categories.length === 1) return (pack ? pack.name + " · " : "") + categories[0].name;
      return categories.length + " sous-catégories" + (pack ? " · " + pack.name : "");
   }
   if (reviewSelectionMode === "manual") return reviewScopeLabel || "Mots sélectionnés";
   return reviewSelectionMode === "all" ? "Tous mes mots" : "À revoir aujourd’hui";
}

function smartQueue() {
   const cards = reviewSelectedCards();
   const due = cards.filter(isDue);
   const fresh = cards.filter((card) => card.due == null && !card.acquired);
   return {
      q: cards,
      dueN: due.length,
      dueTotal: due.length,
      freshN: fresh.length,
      freshTotal: fresh.length,
      nextDue: db.cards.filter((card) => card.due > now()).sort((a, b) => a.due - b.due)[0]?.due || null,
   };
}

function startCardsWith(cards, label, mode) {
   if (typeof resetReviewStrokeSession === "function") resetReviewStrokeSession();
   session = {
      active: true,
      mode: mode || "cards",
      cards,
      index: 0,
      states: new Array(cards.length).fill(null),
      live: { marked: 0, acquired: 0 },
      scopeLabel: label,
   };
   document.body.classList.add("in-session");
   renderSession();
   window.scrollTo(0, 0);
}

function startReviewSelection() {
   const cards = reviewSelectedCards();
   if (!cards.length) {
      toast("Aucune carte disponible avec cette sélection.");
      return;
   }
   // Les identifiants proviennent toujours d'un Set ou d'une relation unique :
   // une carte ne peut donc pas être ajoutée deux fois à une même session.
   startCardsWith(shuffle(cards), scopeLabel(), reviewMode);
}

function startSmartSession() {
   reviewMode = "cards";
   startReviewSelection();
}

function startFreeSession(mode) {
   if (["cards", "written", "discover"].includes(mode)) reviewMode = mode;
   startReviewSelection();
}

function openReviewForPack(packId) {
   reviewSelectionMode = "pack";
   reviewPackId = packId;
   reviewPackIds = new Set(packId ? [packId] : []);
   reviewCategoryPackId = "";
   reviewCategoryIds.clear();
   session = { active: false };
   setView("learn");
}

function openReviewForCategory(categoryId) {
   const category = categoryById(categoryId);
   reviewSelectionMode = "category";
   reviewCategoryIds = new Set(category ? [category.id] : []);
   reviewCategoryPackId = category ? category.packId : "";
   reviewPackId = "";
   reviewPackIds.clear();
   session = { active: false };
   setView("learn");
}

function openReviewForManualCards(cards, label) {
   manualReviewIds = new Set(cards.map((card) => card.id));
   reviewSelectionMode = "manual";
   reviewScopeLabel = label || "Mots sélectionnés";
   session = { active: false };
   setView("learn");
}

function reviewSegment(value, label, help) {
   return '<button class="review-segment" data-review-scope="' + value + '" aria-pressed="' + String(reviewSelectionMode === value) + '"><span>' + label + "</span>" + (help ? '<small>' + help + "</small>" : "") + "</button>";
}

function reviewModeSegment(value, label, description) {
   return '<button class="review-segment review-mode-segment" type="button" data-review-mode="' + value + '" aria-pressed="' + String(reviewMode === value) + '" aria-label="' + esc(label + " — " + description) + '" title="' + esc(description) + '">' + esc(label) + "</button>";
}

function reviewModeDescription() {
   return ({
      cards: "Je révèle la réponse et je m’auto-évalue.",
      written: "J’écris la réponse avant de la vérifier.",
      discover: "Je feuillette sans modifier ma progression.",
   })[reviewMode];
}

function directionSegment(value, label, accessibleLabel) {
   return '<button class="review-segment direction" type="button" data-review-direction="' + value + '" aria-pressed="' + String(db.settings.direction === value) + '" aria-label="' + esc(accessibleLabel || label) + '" title="' + esc(accessibleLabel || label) + '">' + label + "</button>";
}

function conditionalReviewSelectorHtml() {
   if (reviewSelectionMode === "pack") {
      return '<div class="review-multi-picker"><div class="review-category-list-head"><p class="review-picker-label"><strong>' + reviewPackIds.size + '</strong> sélectionné' + (reviewPackIds.size > 1 ? "s" : "") + '</p><div><button class="review-text-action" id="review-packs-all">Tout sélectionner</button><button class="review-text-action" id="review-packs-clear">Effacer</button></div></div><div class="review-category-options" id="review-pack-list">' + (db.packs.map((pack) => '<label class="review-category-option"><input type="checkbox" data-review-pack-option="' + esc(pack.id) + '"' + (reviewPackIds.has(pack.id) ? " checked" : "") + '><span><strong>' + esc(pack.name) + '</strong><small>' + cardsForPack(pack.id).length + ' carte' + (cardsForPack(pack.id).length > 1 ? "s" : "") + "</small></span></label>").join("") || '<p class="review-inline-empty">Aucun pack disponible.</p>') + "</div></div>";
   }
   if (reviewSelectionMode === "category") {
      const categories = reviewCategoryPackId ? categoriesForPack(reviewCategoryPackId) : [];
      return '<div class="review-category-picker"><p class="review-picker-label">1. Choisis un pack</p><div class="review-visual-list compact">' + (db.packs.map((pack) => '<button class="review-list-option" data-review-category-pack-option="' + esc(pack.id) + '" aria-pressed="' + String(pack.id === reviewCategoryPackId) + '"><span>' + esc(pack.name) + '</span><small>' + categoriesForPack(pack.id).length + ' sous-catégorie' + (categoriesForPack(pack.id).length > 1 ? "s" : "") + "</small></button>").join("") || '<p class="review-inline-empty">Aucun pack disponible.</p>') + "</div>" + (reviewCategoryPackId ? '<div class="review-category-list-head"><p class="review-picker-label">2. Sous-catégories · <strong>' + reviewCategoryIds.size + ' sélectionnée' + (reviewCategoryIds.size > 1 ? "s" : "") + '</strong></p><div><button class="review-text-action" id="review-categories-all">Tout sélectionner</button><button class="review-text-action" id="review-categories-clear">Effacer</button></div></div><div class="review-category-options">' + (categories.map((category) => '<label class="review-category-option"><input type="checkbox" data-review-category-option="' + esc(category.id) + '"' + (reviewCategoryIds.has(category.id) ? " checked" : "") + '><span><strong>' + esc(category.name) + '</strong><small>' + cardsForCategory(category.id).length + ' carte' + (cardsForCategory(category.id).length > 1 ? "s" : "") + "</small></span></label>").join("") || '<p class="review-inline-empty">Ce pack ne contient aucune sous-catégorie.</p>') + "</div>" : "") + "</div>";
   }
   if (reviewSelectionMode === "manual") {
      return '<p class="review-manual-note"><strong>' + manualReviewIds.size + ' mot' + (manualReviewIds.size > 1 ? "s" : "") + '</strong> choisi' + (manualReviewIds.size > 1 ? "s" : "") + ' depuis Mes mots.</p>';
   }
   return "";
}

function extraFilterCheckbox(key, label) {
   return '<label class="review-filter"><input type="checkbox" data-review-filter="' + key + '"' + (reviewExtraFilters[key] ? " checked" : "") + "><span>" + label + "</span></label>";
}

function writingSettingCheckbox(key, label) {
   return '<label class="review-filter"><input type="checkbox" data-writing-setting="' + key + '"' + (db.settings.writeModes[key] ? " checked" : "") + "><span>" + label + "</span></label>";
}

function renderLearn() {
   document.body.classList.toggle("in-session", session.active);
   if (session.active) { renderSession(); return; }
   if (session.summary) { renderSummary(); return; }

   if (!["all", "due", "pack", "category", "manual"].includes(reviewSelectionMode))
      reviewSelectionMode = "due";
   reviewPackIds = new Set(Array.from(reviewPackIds).filter((id) => db.packs.some((pack) => pack.id === id)));
   reviewPackId = reviewPackIds.values().next().value || "";
   if (!reviewCategoryPackId || !db.packs.some((pack) => pack.id === reviewCategoryPackId)) reviewCategoryPackId = "";
   reviewCategoryIds = new Set(
      Array.from(reviewCategoryIds).filter((id) => {
         const category = categoryById(id);
         return category && category.packId === reviewCategoryPackId;
      }),
   );
   if (!["cards", "written", "discover"].includes(reviewMode)) reviewMode = "cards";

   const root = $("view");
   const cards = reviewSelectedCards();
   const minutes = cards.length ? Math.max(1, Math.round(cards.length * 25 / 60)) : 0;
   const resume = loadSavedSession();
   root.innerHTML = '<section class="review-page review-page-simple"><header class="review-simple-heading"><p class="eyebrow">Révision personnelle</p><h2 class="v-t">复 · Réviser</h2></header>' +
      '<section class="review-block card" aria-labelledby="review-content-title"><div class="review-block-title"><span>1</span><div><h3 id="review-content-title">Choisir le contenu</h3><p>Que veux-tu réviser ?</p></div></div><div class="review-segments review-scope-segments">' + reviewSegment("all", "Tous mes mots") + reviewSegment("pack", "Un ou plusieurs packs") + reviewSegment("category", "Une ou plusieurs sous-catégories") + reviewSegment("due", "À revoir aujourd’hui", "Cartes prévues par ton système de révision.") + '</div><div id="review-conditional">' + conditionalReviewSelectorHtml() + "</div></section>" +
      '<section class="review-block review-preferences-block card" aria-label="Mode et sens de révision">' +
      '<div class="review-choice-row"><div class="review-choice-label"><span>2</span><h3 id="review-mode-title">Mode</h3></div>' +
      '<div class="review-segments review-mode-segments" aria-labelledby="review-mode-title">' + reviewModeSegment("cards", "卡 Cartes", "Je révèle la réponse et je m’auto-évalue") + reviewModeSegment("written", "写 Écriture", "J’écris la réponse avant de la vérifier") + reviewModeSegment("discover", "览 Découverte", "Je feuillette sans modifier ma progression") + '</div><p class="review-mode-description" aria-live="polite">' + esc(reviewModeDescription()) + "</p></div>" +
      '<div class="review-choice-row"><div class="review-choice-label"><span>3</span><h3 id="review-direction-title">Sens</h3></div>' +
      '<div class="review-segments review-direction-segments" aria-labelledby="review-direction-title">' + directionSegment("zh2fr", "中文 → Fr", "Chinois vers français") + directionSegment("fr2zh", "Fr → 中文", "Français vers chinois") + directionSegment("mix", "混 · Mixte", "Mélanger les deux sens") + "</div></div></section>" +
      '<details class="review-advanced card" id="review-options"' + (reviewOptionsOpen ? " open" : "") + '><summary>Réglages avancés</summary><div class="review-filter-grid">' + extraFilterCheckbox("newOnly", "Uniquement les nouveaux mots") + extraFilterCheckbox("favoritesOnly", "Uniquement les favoris") + extraFilterCheckbox("difficultOnly", "Uniquement les mots difficiles") + extraFilterCheckbox("includeLearned", "Inclure les cartes déjà maîtrisées") + (reviewMode === "written" ? '<div class="review-writing-options"><p>Exercices d’écriture</p>' + writingSettingCheckbox("fr", "Traduction française") + writingSettingCheckbox("pinyin", "Pinyin") + writingSettingCheckbox("trace", "Tracé des caractères") + "</div>" : "") + "</div></details>" +
      '<section class="review-block review-start-block card" aria-labelledby="review-summary-title"><div class="review-block-title"><span>4</span><h3 id="review-summary-title">Démarrer</h3></div>' + (resume ? '<div class="resume review-resume"><span>Séance en cours · ' + Math.min(resume.snap.index + 1, resume.cards.length) + ' / ' + resume.cards.length + '</span><span><button class="btn sm" id="btn-resume">Reprendre</button><button class="btn sm ghost" id="btn-resume-x">Ignorer</button></span></div>' : "") + '<p class="review-compact-summary" aria-live="polite"><strong>' + cards.length + ' carte' + (cards.length > 1 ? "s" : "") + '</strong> · environ ' + minutes + ' min</p>' + (!cards.length ? '<p class="review-empty-message">Aucune carte disponible avec cette sélection.</p>' : "") + '<button class="btn primary big review-start" id="btn-continue"' + (cards.length ? "" : " disabled") + '>Commencer</button></section></section>';

   document.querySelectorAll("[data-review-scope]").forEach((button) => button.onclick = () => {
      reviewSelectionMode = button.dataset.reviewScope;
      renderLearn();
   });
   document.querySelectorAll("[data-review-direction]").forEach((button) => button.onclick = () => {
      db.settings.direction = button.dataset.reviewDirection;
      save();
      renderLearn();
   });
   document.querySelectorAll("[data-review-mode]").forEach((button) => button.onclick = () => {
      reviewMode = button.dataset.reviewMode;
      renderLearn();
   });
   document.querySelectorAll("[data-review-pack-option]").forEach((input) => input.onchange = () => {
      if (input.checked) reviewPackIds.add(input.dataset.reviewPackOption);
      else reviewPackIds.delete(input.dataset.reviewPackOption);
      reviewPackId = reviewPackIds.values().next().value || "";
      renderLearn();
   });
   if ($("review-packs-all")) $("review-packs-all").onclick = () => {
      reviewPackIds = new Set(db.packs.map((pack) => pack.id));
      reviewPackId = reviewPackIds.values().next().value || "";
      renderLearn();
   };
   if ($("review-packs-clear")) $("review-packs-clear").onclick = () => {
      reviewPackIds.clear();
      reviewPackId = "";
      renderLearn();
   };
   document.querySelectorAll("[data-review-category-pack-option]").forEach((button) => button.onclick = () => {
      reviewCategoryPackId = button.dataset.reviewCategoryPackOption;
      reviewCategoryIds.clear();
      renderLearn();
   });
   document.querySelectorAll("[data-review-category-option]").forEach((input) => input.onchange = () => {
      if (input.checked) reviewCategoryIds.add(input.dataset.reviewCategoryOption);
      else reviewCategoryIds.delete(input.dataset.reviewCategoryOption);
      renderLearn();
   });
   if ($("review-categories-all")) $("review-categories-all").onclick = () => {
      reviewCategoryIds = new Set(categoriesForPack(reviewCategoryPackId).map((category) => category.id));
      renderLearn();
   };
   if ($("review-categories-clear")) $("review-categories-clear").onclick = () => {
      reviewCategoryIds.clear();
      renderLearn();
   };
   const options = $("review-options");
   options.ontoggle = () => { reviewOptionsOpen = options.open; };
   document.querySelectorAll("[data-review-filter]").forEach((input) => input.onchange = () => {
      reviewOptionsOpen = true;
      reviewExtraFilters[input.dataset.reviewFilter] = input.checked;
      renderLearn();
   });
   document.querySelectorAll("[data-writing-setting]").forEach((input) => input.onchange = () => {
      const next = Object.assign({}, db.settings.writeModes, { [input.dataset.writingSetting]: input.checked });
      if (!next.fr && !next.pinyin && !next.trace) {
         toast("Garde au moins un exercice d’écriture.");
         input.checked = true;
         return;
      }
      db.settings.writeModes = next;
      reviewOptionsOpen = true;
      save();
      renderLearn();
   });
   $("btn-continue").onclick = startReviewSelection;
   if ($("btn-resume")) $("btn-resume").onclick = resumeSession;
   if ($("btn-resume-x")) $("btn-resume-x").onclick = () => { clearSavedSession(); renderLearn(); };
}
