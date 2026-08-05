"use strict";

/* ================= Réviser : sélection explicite ================= */
let reviewSelectionMode = "due";
let reviewPackId = "";
let reviewCategoryIds = new Set();
let manualReviewIds = new Set();
let reviewScopeLabel = "Cartes dues aujourd’hui";
let hub = { flt: "due", pack: "", cat: "", includeAcquired: true, freeOpen: true };

function reviewSelectedCards() {
   let cards = db.cards.slice();
   if (reviewSelectionMode === "due") cards = cards.filter(isDue);
   else if (reviewSelectionMode === "all") cards = cards;
   else if (reviewSelectionMode === "pack") cards = cardsForPack(reviewPackId);
   else if (reviewSelectionMode === "categories") {
      const ids = new Set(Array.from(reviewCategoryIds).flatMap(categoryCardIds));
      cards = cards.filter((card) => ids.has(card.id));
   } else if (reviewSelectionMode === "manual") cards = cards.filter((card) => manualReviewIds.has(card.id));
   else if (reviewSelectionMode === "fav") cards = cards.filter((card) => card.fav);
   else if (reviewSelectionMode === "difficult") cards = cards.filter((card) => card.difficult);
   else if (reviewSelectionMode === "new") cards = cards.filter((card) => card.due == null && !card.acquired);
   else if (reviewSelectionMode === "learned") cards = cards.filter((card) => card.acquired || card.due != null || (card.lvl || 0) > 0);
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
   if (reviewSelectionMode === "categories") return reviewCategoryIds.size + " sous-catégorie(s)";
   if (reviewSelectionMode === "manual") return reviewScopeLabel || "Sélection manuelle";
   return ({ due: "Cartes dues aujourd’hui", all: "Tous mes mots", fav: "Favoris", difficult: "Mots difficiles", new: "Nouveaux mots", learned: "Cartes déjà apprises" })[reviewSelectionMode] || "Révision";
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
      freshUnit: fresh.length ? fresh[0].unit : null,
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

function startSmartSession() {
   startReviewSelection("cards");
}

function startFreeSession(mode) {
   startReviewSelection(mode);
}

function startReviewSelection(mode) {
   const cards = reviewSelectedCards();
   if (!cards.length) { toast("Aucune carte dans cette sélection."); return; }
   startCardsWith(shuffle(cards), scopeLabel(), mode || "cards");
}

function emptyHtml() {
   return '<section class="card pad empty"><div class="empty-hz">学</div><h2 class="empty-t">Ta collection est vide</h2><p class="empty-p">Crée un mot ou importe un pack. Les 5 399 mots HSK ne sont jamais ajoutés automatiquement ici.</p><div class="empty-btns"><button class="btn primary" id="btn-e-import">Importer un pack</button><button class="btn" id="btn-e-add">Créer un mot</button></div></section>';
}

function wireEmpty() {
   if ($("btn-e-add")) $("btn-e-add").onclick = () => openCardForm(null);
   if ($("btn-e-import")) $("btn-e-import").onclick = openPackImportSheet;
}

function reviewChoiceHtml(value, title, detail) {
   return '<label class="review-choice"><input type="radio" name="review-scope" value="' + value + '"' + (reviewSelectionMode === value ? " checked" : "") + '><span><strong>' + title + '</strong><small>' + detail + "</small></span></label>";
}

function reviewCategoryTreeHtml() {
   if (!db.packs.length) return '<p class="sh-note">Aucun pack organisé pour le moment.</p>';
   return '<div class="review-tree">' + db.packs.map((pack) => {
      const categories = categoriesForPack(pack.id);
      const allChecked = categories.length && categories.every((category) => reviewCategoryIds.has(category.id));
      return '<section class="review-tree-pack"><div class="review-tree-pack-head"><label class="ck"><input type="checkbox" data-review-pack-check="' + esc(pack.id) + '"' + (allChecked ? " checked" : "") + '> <strong>' + esc(pack.name) + '</strong></label><button class="btn sm ghost" data-review-entire-pack="' + esc(pack.id) + '">Pack entier</button></div>' + categories.map((category) => '<label class="ck review-category-check"><input type="checkbox" data-review-category="' + esc(category.id) + '"' + (reviewCategoryIds.has(category.id) ? " checked" : "") + '> ' + esc(category.name) + '<span>' + cardsForCategory(category.id).length + "</span></label>").join("") + "</section>";
   }).join("") + "</div>";
}

function reviewMetricsHtml(cards) {
   const fresh = cards.filter((card) => card.due == null && !card.acquired).length;
   const due = cards.filter(isDue).length;
   const minutes = cards.length ? Math.max(1, Math.round(cards.length * 25 / 60)) : 0;
   return '<div class="review-live" aria-live="polite"><div><b>' + cards.length + '</b><span>Cartes sélectionnées</span></div><div><b>' + fresh + '</b><span>Nouvelles cartes</span></div><div><b>' + due + '</b><span>Cartes dues</span></div><div><b>~' + minutes + ' min</b><span>Durée estimée</span></div></div>';
}

function renderLearn() {
   document.body.classList.toggle("in-session", session.active);
   if (session.active) { renderSession(); return; }
   if (session.summary) { renderSummary(); return; }
   const root = $("view");
   const resume = loadSavedSession();
   const selected = reviewSelectedCards();
   root.innerHTML = '<section class="review-page"><header class="review-heading"><div class="review-mark">复</div><div><p class="eyebrow">Révision personnelle</p><h2 class="v-t" id="review-title">Que veux-tu réviser ?</h2><p class="muted">Choisis exactement les cartes de cette séance. Cette sélection ne modifie jamais tes packs.</p></div></header>' +
      (resume ? '<div class="resume"><span>Séance en cours · ' + Math.min(resume.snap.index + 1, resume.cards.length) + ' / ' + resume.cards.length + '</span><span><button class="btn sm primary" id="btn-resume">Reprendre</button><button class="btn sm ghost" id="btn-resume-x">Fermer</button></span></div>' : "") +
      (!db.cards.length ? emptyHtml() : '<div class="review-layout"><section class="review-scope card"><h3>Type de sélection</h3><div class="review-choice-grid">' +
         reviewChoiceHtml("due", "Cartes dues aujourd’hui", db.cards.filter(isDue).length + " cartes") +
         reviewChoiceHtml("all", "Tous mes mots", db.cards.length + " cartes") +
         reviewChoiceHtml("pack", "Un pack entier", "Choisir dans la liste") +
         reviewChoiceHtml("categories", "Une ou plusieurs sous-catégories", reviewCategoryIds.size + " cochée(s)") +
         reviewChoiceHtml("manual", "Seulement les mots sélectionnés", manualReviewIds.size + " carte(s)") +
         reviewChoiceHtml("fav", "Favoris", db.cards.filter((card) => card.fav).length + " cartes") +
         reviewChoiceHtml("difficult", "Mots difficiles", db.cards.filter((card) => card.difficult).length + " cartes") +
         reviewChoiceHtml("new", "Nouveaux mots", db.cards.filter((card) => card.due == null && !card.acquired).length + " cartes") +
         reviewChoiceHtml("learned", "Cartes déjà apprises", db.cards.filter((card) => card.acquired || card.due != null || (card.lvl || 0) > 0).length + " cartes") +
         '</div><label class="f-lab review-pack-select">Pack entier<select class="search" id="review-pack-select"><option value="">Choisir un pack</option>' + db.packs.map((pack) => '<option value="' + esc(pack.id) + '"' + (reviewPackId === pack.id ? " selected" : "") + '>' + esc(pack.name) + "</option>").join("") + '</select></label></section><section class="review-categories card"><div class="review-section-title"><div><h3>Packs et sous-catégories</h3><p>Les cases peuvent être combinées librement.</p></div><button class="btn sm ghost" id="review-clear-categories">Effacer</button></div>' + reviewCategoryTreeHtml() + '</section></div>' +
         reviewMetricsHtml(selected) + '<section class="review-launch card"><div><label class="f-lab">Mode<select class="search" id="review-mode"><option value="cards">Cartes</option><option value="written">Écrit</option><option value="discover">Découverte</option></select></label></div><button class="btn primary big" id="btn-continue"' + (selected.length ? "" : " disabled") + '>Commencer la révision</button><button class="btn ghost" id="review-open-library">Ouvrir Mes mots</button></section><details id="free-panel" class="review-compat"><summary>Options de séance</summary><div class="modes"><button data-mode="cards">Cartes</button><button data-mode="written">Écrit</button><button data-mode="discover">Découverte</button></div></details>') + "</section>";
   if (!db.cards.length) { wireEmpty(); return; }
   if ($("btn-resume")) $("btn-resume").onclick = resumeSession;
   if ($("btn-resume-x")) $("btn-resume-x").onclick = () => { clearSavedSession(); renderLearn(); };
   document.querySelectorAll('input[name="review-scope"]').forEach((input) => input.onchange = () => { reviewSelectionMode = input.value; renderLearn(); });
   $("review-pack-select").onchange = (event) => { reviewPackId = event.target.value; reviewSelectionMode = "pack"; renderLearn(); };
   document.querySelectorAll("[data-review-category]").forEach((input) => input.onchange = () => {
      if (input.checked) reviewCategoryIds.add(input.dataset.reviewCategory); else reviewCategoryIds.delete(input.dataset.reviewCategory);
      reviewSelectionMode = "categories"; renderLearn();
   });
   document.querySelectorAll("[data-review-pack-check]").forEach((input) => input.onchange = () => {
      categoriesForPack(input.dataset.reviewPackCheck).forEach((category) => input.checked ? reviewCategoryIds.add(category.id) : reviewCategoryIds.delete(category.id));
      reviewSelectionMode = "categories"; renderLearn();
   });
   document.querySelectorAll("[data-review-entire-pack]").forEach((button) => button.onclick = () => { reviewPackId = button.dataset.reviewEntirePack; reviewSelectionMode = "pack"; renderLearn(); });
   $("review-clear-categories").onclick = () => { reviewCategoryIds.clear(); reviewSelectionMode = "categories"; renderLearn(); };
   $("btn-continue").onclick = () => startReviewSelection($("review-mode").value);
   $("review-open-library").onclick = () => setView("lib");
   document.querySelectorAll("[data-mode]").forEach((button) => button.onclick = () => startReviewSelection(button.dataset.mode));
}
