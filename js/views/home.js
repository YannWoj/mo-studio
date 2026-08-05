"use strict";

/* ================= Réviser : sélection compacte ================= */
let reviewSelectionMode = "due";
let reviewPackId = "";
let reviewCategoryPackId = "";
let reviewCategoryId = "";
let manualReviewIds = new Set();
let reviewScopeLabel = "Mots sélectionnés";
let reviewOptionsOpen = false;
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
   if (reviewSelectionMode === "pack") return reviewPackId ? cardsForPack(reviewPackId) : [];
   if (reviewSelectionMode === "category") return reviewCategoryId ? cardsForCategory(reviewCategoryId) : [];
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
      const pack = db.packs.find((item) => item.id === reviewPackId);
      return pack ? "Pack · " + pack.name : "Pack";
   }
   if (reviewSelectionMode === "category") {
      const category = categoryById(reviewCategoryId);
      const pack = category && db.packs.find((item) => item.id === category.packId);
      return category ? (pack ? pack.name + " · " : "") + category.name : "Sous-catégorie";
   }
   if (reviewSelectionMode === "manual") return reviewScopeLabel || "Mots sélectionnés";
   return reviewSelectionMode === "all" ? "Tous mes mots" : "Cartes dues";
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
   startCardsWith(shuffle(cards), scopeLabel(), "cards");
}

function startSmartSession() {
   startReviewSelection();
}

function startFreeSession() {
   startReviewSelection();
}

function openReviewForPack(packId) {
   reviewSelectionMode = "pack";
   reviewPackId = packId;
   reviewCategoryPackId = "";
   reviewCategoryId = "";
   session = { active: false };
   setView("learn");
}

function openReviewForCategory(categoryId) {
   const category = categoryById(categoryId);
   reviewSelectionMode = "category";
   reviewCategoryId = category ? category.id : "";
   reviewCategoryPackId = category ? category.packId : "";
   reviewPackId = "";
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

function reviewSegment(value, label) {
   return '<button class="review-segment" data-review-scope="' + value + '" aria-pressed="' + String(reviewSelectionMode === value) + '">' + label + "</button>";
}

function directionSegment(value, label) {
   return '<button class="review-segment direction" data-review-direction="' + value + '" aria-pressed="' + String(db.settings.direction === value) + '">' + label + "</button>";
}

function conditionalReviewSelectorHtml() {
   if (reviewSelectionMode === "pack") {
      return '<label class="review-conditional-label">Choisir un pack<select class="search" id="review-pack-select"><option value="">Sélectionner…</option>' + db.packs.map((pack) => '<option value="' + esc(pack.id) + '"' + (pack.id === reviewPackId ? " selected" : "") + '>' + esc(pack.name) + "</option>").join("") + "</select></label>";
   }
   if (reviewSelectionMode === "category") {
      const categories = reviewCategoryPackId ? categoriesForPack(reviewCategoryPackId) : [];
      return '<div class="review-conditional-grid"><label class="review-conditional-label">Pack<select class="search" id="review-category-pack"><option value="">Sélectionner…</option>' + db.packs.map((pack) => '<option value="' + esc(pack.id) + '"' + (pack.id === reviewCategoryPackId ? " selected" : "") + '>' + esc(pack.name) + "</option>").join("") + '</select></label><label class="review-conditional-label">Sous-catégorie<select class="search" id="review-category-select"' + (reviewCategoryPackId ? "" : " disabled") + '><option value="">Sélectionner…</option>' + categories.map((category) => '<option value="' + esc(category.id) + '"' + (category.id === reviewCategoryId ? " selected" : "") + '>' + esc(category.name) + "</option>").join("") + "</select></label></div>";
   }
   if (reviewSelectionMode === "manual") {
      return '<p class="review-manual-note"><strong>' + manualReviewIds.size + ' mot' + (manualReviewIds.size > 1 ? "s" : "") + '</strong> reçu' + (manualReviewIds.size > 1 ? "s" : "") + ' depuis Mes mots.</p>';
   }
   return "";
}

function extraFilterCheckbox(key, label) {
   return '<label class="review-filter"><input type="checkbox" data-review-filter="' + key + '"' + (reviewExtraFilters[key] ? " checked" : "") + "><span>" + label + "</span></label>";
}

function renderLearn() {
   document.body.classList.toggle("in-session", session.active);
   if (session.active) { renderSession(); return; }
   if (session.summary) { renderSummary(); return; }

   if (!["all", "due", "pack", "category", "manual"].includes(reviewSelectionMode))
      reviewSelectionMode = "due";
   if (!reviewPackId || !db.packs.some((pack) => pack.id === reviewPackId)) reviewPackId = "";
   if (!reviewCategoryPackId || !db.packs.some((pack) => pack.id === reviewCategoryPackId)) reviewCategoryPackId = "";
   if (!reviewCategoryId || !categoryById(reviewCategoryId)) reviewCategoryId = "";

   const root = $("view");
   const cards = reviewSelectedCards();
   const minutes = cards.length ? Math.max(1, Math.round(cards.length * 25 / 60)) : 0;
   const resume = loadSavedSession();
   root.innerHTML = '<section class="review-page review-page-simple"><header class="review-simple-heading"><p class="eyebrow">Révision personnelle</p><h2 class="v-t">复 · Réviser</h2></header>' +
      '<section class="review-block card" aria-labelledby="review-what-title"><div class="review-block-title"><span>1</span><h3 id="review-what-title">Que réviser ?</h3></div><div class="review-segments review-scope-segments">' + reviewSegment("all", "Tout") + reviewSegment("due", "Cartes dues") + reviewSegment("pack", "Un pack") + reviewSegment("category", "Une sous-catégorie") + reviewSegment("manual", "Mots sélectionnés") + '</div><div id="review-conditional">' + conditionalReviewSelectorHtml() + '</div><details class="review-more" id="review-options"' + (reviewOptionsOpen ? " open" : "") + '><summary>Options supplémentaires</summary><div class="review-filter-grid">' + extraFilterCheckbox("newOnly", "Uniquement nouveaux") + extraFilterCheckbox("favoritesOnly", "Uniquement favoris") + extraFilterCheckbox("difficultOnly", "Uniquement difficiles") + extraFilterCheckbox("includeLearned", "Inclure les cartes déjà apprises") + "</div></details></section>" +
      '<section class="review-block card" aria-labelledby="review-direction-title"><div class="review-block-title"><span>2</span><h3 id="review-direction-title">Sens des cartes</h3></div><div class="review-segments review-direction-segments">' + directionSegment("zh2fr", "中文 → Français") + directionSegment("fr2zh", "Français → 中文") + directionSegment("mix", "Mélanger les deux") + "</div></section>" +
      '<section class="review-block review-start-block card" aria-labelledby="review-summary-title"><div class="review-block-title"><span>3</span><h3 id="review-summary-title">Prêt à commencer</h3></div>' + (resume ? '<div class="resume review-resume"><span>Séance en cours · ' + Math.min(resume.snap.index + 1, resume.cards.length) + ' / ' + resume.cards.length + '</span><span><button class="btn sm" id="btn-resume">Reprendre</button><button class="btn sm ghost" id="btn-resume-x">Ignorer</button></span></div>' : "") + '<p class="review-compact-summary" aria-live="polite"><strong>' + cards.length + ' carte' + (cards.length > 1 ? "s" : "") + '</strong> · environ ' + minutes + ' min</p>' + (!cards.length ? '<p class="review-empty-message">Aucune carte disponible avec cette sélection.</p>' : "") + '<button class="btn primary big review-start" id="btn-continue"' + (cards.length ? "" : " disabled") + '>Commencer la révision</button></section></section>';

   document.querySelectorAll("[data-review-scope]").forEach((button) => button.onclick = () => {
      reviewSelectionMode = button.dataset.reviewScope;
      renderLearn();
   });
   document.querySelectorAll("[data-review-direction]").forEach((button) => button.onclick = () => {
      db.settings.direction = button.dataset.reviewDirection;
      save();
      renderLearn();
   });
   if ($("review-pack-select")) $("review-pack-select").onchange = (event) => {
      reviewPackId = event.target.value;
      renderLearn();
   };
   if ($("review-category-pack")) $("review-category-pack").onchange = (event) => {
      reviewCategoryPackId = event.target.value;
      reviewCategoryId = "";
      renderLearn();
   };
   if ($("review-category-select")) $("review-category-select").onchange = (event) => {
      reviewCategoryId = event.target.value;
      renderLearn();
   };
   const options = $("review-options");
   options.ontoggle = () => { reviewOptionsOpen = options.open; };
   document.querySelectorAll("[data-review-filter]").forEach((input) => input.onchange = () => {
      reviewOptionsOpen = true;
      reviewExtraFilters[input.dataset.reviewFilter] = input.checked;
      renderLearn();
   });
   $("btn-continue").onclick = startReviewSelection;
   if ($("btn-resume")) $("btn-resume").onclick = resumeSession;
   if ($("btn-resume-x")) $("btn-resume-x").onclick = () => { clearSavedSession(); renderLearn(); };
}
