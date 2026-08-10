"use strict";

/* ================= Mes mots : packs, catégories et cartes ================= */
let lib = {
   level: "packs",
   packId: "",
   categoryId: "",
   q: "",
   flt: "all",
   selected: new Set(),
};

let libraryVirtualSections = {
   favorites: false,
   review: false,
};

const LIBRARY_REVIEW_GRADES = new Set(["again", "hard", "good", "easy"]);

function dueCount(cards, referenceNow) {
   if (Number.isFinite(referenceNow))
      return cards.filter((card) => Number.isFinite(card.due) && card.due <= referenceNow).length;
   return cards.filter(isDue).length;
}

function uniqueLibraryCards(cards) {
   const ids = new Set();
   return (cards || []).filter((card) => {
      const id = card && String(card.id || "");
      if (!id || ids.has(id)) return false;
      ids.add(id);
      return true;
   });
}

function latestLibraryReviewEvent(card) {
   return (Array.isArray(card && card.reviewHistory) ? card.reviewHistory : [])
      .filter((event) =>
         event && Number.isFinite(event.at) && LIBRARY_REVIEW_GRADES.has(event.grade),
      )
      .sort((left, right) => right.at - left.at)[0] || null;
}

function libraryVirtualData(cards, renderedAt) {
   const values = uniqueLibraryCards(cards);
   const eventById = new Map(values.map((card) => [card.id, latestLibraryReviewEvent(card)]));
   const dueNow = values
      .filter((card) => Number.isFinite(card.due) && card.due <= renderedAt)
      .sort((left, right) => left.due - right.due);
   const future = values
      .filter((card) => Number.isFinite(card.due) && card.due > renderedAt)
      .sort((left, right) => left.due - right.due);
   const byLatestEvent = (grade) => values
      .filter((card) => eventById.get(card.id)?.grade === grade)
      .sort((left, right) => eventById.get(right.id).at - eventById.get(left.id).at);
   return {
      renderedAt,
      favorites: values.filter((card) => card.fav).sort((left, right) => right.created - left.created),
      dueNow,
      future,
      scheduled: uniqueLibraryCards([...dueNow, ...future]),
      failed: byLatestEvent("again"),
      hard: byLatestEvent("hard"),
      eventById,
   };
}

function libraryRelativeDue(due, renderedAt) {
   if (!Number.isFinite(due)) return "";
   const delta = due - renderedAt;
   if (delta <= 0) return "maintenant";
   if (delta < 60 * 60e3)
      return "dans " + Math.max(1, Math.ceil(delta / 60e3)) + " min";
   if (delta < 48 * 60 * 60e3)
      return "dans " + Math.max(1, Math.ceil(delta / (60 * 60e3))) + " h";
   return "dans " + Math.max(1, Math.ceil(delta / (24 * 60 * 60e3))) + " j";
}

function libraryLocalDateTime(value) {
   if (!Number.isFinite(value)) return "";
   try {
      return new Intl.DateTimeFormat("fr-FR", {
         dateStyle: "medium",
         timeStyle: "short",
      }).format(new Date(value));
   } catch (error) {
      return "";
   }
}

function libraryVirtualCardHtml(card, group, timing) {
   const detail = timing && Number.isFinite(timing.at)
      ? '<time datetime="' + new Date(timing.at).toISOString() + '" title="' +
        esc(timing.exact || "") + '"><span>' + esc(timing.label) + "</span>" +
        (timing.exact ? "<small>" + esc(timing.exact) + "</small>" : "") + "</time>"
      : "";
   return '<button type="button" class="library-virtual-card" data-virtual-card="' +
      esc(card.id) + '" data-virtual-card-group="' + esc(group) + '"><span class="row-hz">' +
      esc(card.hz) + '</span><span class="library-virtual-card-copy"><strong>' +
      (card.fr ? esc(card.fr) : "Traduction manquante") + '</strong><span>' +
      (card.py ? colorPinyin(card.py) : "Pinyin manquant") + "</span></span>" + detail + "</button>";
}

function libraryVirtualPreviewHtml(cards, group, timingForCard, emptyText) {
   if (!cards.length)
      return '<p class="library-virtual-empty">' + esc(emptyText) + "</p>";
   const shown = cards.slice(0, 4);
   return '<div class="library-virtual-list">' + shown.map((card) =>
      libraryVirtualCardHtml(card, group, timingForCard ? timingForCard(card) : null),
   ).join("") + "</div>" + (cards.length > shown.length
      ? '<p class="library-virtual-more">+' + (cards.length - shown.length) + " autre" +
        (cards.length - shown.length > 1 ? "s" : "") + "</p>"
      : "");
}

function libraryVirtualSectionShell(kind, icon, title, summary, content) {
   const open = !!libraryVirtualSections[kind];
   const panelId = "library-virtual-" + kind + "-content";
   return '<article class="library-virtual-section library-virtual-' + kind +
      (open ? " is-open" : "") + '" data-virtual-section="' + kind + '">' +
      '<button type="button" class="library-virtual-toggle" data-virtual-toggle="' + kind +
      '" aria-expanded="' + String(open) + '" aria-controls="' + panelId + '">' +
      '<span class="library-virtual-icon" aria-hidden="true">' + icon + "</span>" +
      '<span class="library-virtual-heading"><strong>' + title + "</strong><span>" + summary +
      '</span></span><span class="library-virtual-chevron" aria-hidden="true">⌄</span></button>' +
      '<div class="library-virtual-content" id="' + panelId + '"' + (open ? "" : " hidden") +
      ">" + content + "</div></article>";
}

function libraryFavoritesSectionHtml(data) {
   const count = data.favorites.length;
   const summary = count
      ? '<b data-virtual-favorite-count>' + count + "</b> favori" + (count > 1 ? "s" : "")
      : '<b data-virtual-favorite-count>0</b> favori · ajoute une étoile à tes mots clés';
   const preview = libraryVirtualPreviewHtml(
      data.favorites,
      "favorites",
      null,
      "Aucun favori pour le moment.",
   );
   const content = preview + '<div class="library-virtual-actions"><button class="btn" type="button" data-virtual-list="favorites">Voir les favoris</button>' +
      '<button class="btn primary" type="button" data-virtual-review="favorites"' +
      (count ? "" : " disabled") + ">Réviser les favoris</button></div>";
   return libraryVirtualSectionShell("favorites", "★", "Favoris", summary, content);
}

function librarySmartGroupHtml(key, title, cards, data, options) {
   const settings = options || {};
   const timingForCard = settings.timing === "due"
      ? (card) => ({
           at: card.due,
           label: libraryRelativeDue(card.due, data.renderedAt),
           exact: libraryLocalDateTime(card.due),
        })
      : settings.timing === "history"
        ? (card) => {
             const event = data.eventById.get(card.id);
             return {
                at: event.at,
                label: event.grade === "again" ? "Dernière note · raté" : "Dernière note · difficile",
                exact: libraryLocalDateTime(event.at),
             };
          }
        : null;
   return '<section class="library-smart-group" data-smart-group="' + key + '"><header><div><h4>' +
      title + '</h4><span>' + cards.length + " carte" + (cards.length > 1 ? "s" : "") +
      "</span></div></header>" + libraryVirtualPreviewHtml(
         cards,
         key,
         timingForCard,
         settings.empty,
      ) + '<div class="library-smart-actions"><button class="btn sm primary" type="button" data-virtual-review="' +
      key + '"' + (cards.length ? "" : " disabled") + ">" + settings.action + "</button>" +
      (settings.list ? '<button class="btn sm ghost" type="button" data-virtual-list="' + settings.list.key +
         '">' + settings.list.label + "</button>" : "") + "</div></section>";
}

function libraryReviewSectionHtml(data) {
   const nearest = data.future[0];
   const summary = '<b data-smart-due-count>' + data.dueNow.length + "</b> maintenant · <b data-smart-future-count>" +
      data.future.length + "</b> plus tard" + (nearest
         ? ' · <span data-smart-nearest title="' + esc(libraryLocalDateTime(nearest.due)) + '">' +
           esc(libraryRelativeDue(nearest.due, data.renderedAt)) + "</span>"
         : "");
   const content = '<div class="library-smart-grid">' +
      librarySmartGroupHtml("due", "À revoir maintenant", data.dueNow, data, {
         timing: "due",
         empty: "Aucune carte arrivée à échéance.",
         action: "Réviser maintenant",
         list: { key: "due", label: "Voir les cartes dues" },
      }) +
      librarySmartGroupHtml("scheduled", "Plus tard", data.future, data, {
         timing: "due",
         empty: "Aucune révision programmée plus tard.",
         action: "Réviser tout, même en avance",
      }) +
      librarySmartGroupHtml("failed", "Ratés", data.failed, data, {
         timing: "history",
         empty: "Aucune dernière note « raté ».",
         action: "Réviser les ratés",
      }) +
      librarySmartGroupHtml("hard", "Difficiles", data.hard, data, {
         timing: "history",
         empty: "Aucune dernière note « difficile ».",
         action: "Réviser les difficiles",
      }) + "</div>";
   return libraryVirtualSectionShell("review", "复", "À revoir", summary, content);
}

function libraryVirtualSectionsHtml(data) {
   return '<div class="library-virtual-stack" aria-label="Vues intelligentes de Mes mots">' +
      libraryFavoritesSectionHtml(data) + libraryReviewSectionHtml(data) + "</div>";
}

function libraryScopeCards() {
   if (lib.level === "category" && lib.categoryId) return cardsForCategory(lib.categoryId);
   if (lib.level === "pack" && lib.packId) return cardsForPack(lib.packId);
   return db.cards.slice();
}

function libraryFilteredCards() {
   let cards = libraryScopeCards();
   const query = lib.q.trim();
   const flat = flatten(query);
   if (query) {
      cards = cards.filter((card) =>
         card.hz.includes(query) ||
         flatten(card.py).includes(flat) ||
         flatten(card.fr).includes(flat) ||
         flatten((card.tags || []).join(" ")).includes(flat),
      );
   }
   if (lib.flt === "fav") cards = cards.filter((card) => card.fav);
   else if (lib.flt === "difficult") cards = cards.filter((card) => card.difficult);
   else if (lib.flt === "new") cards = cards.filter((card) => card.due == null && !card.acquired);
   else if (lib.flt === "mastered") cards = cards.filter((card) => card.acquired);
   else if (lib.flt === "due") cards = cards.filter(isDue);
   return cards.sort((a, b) => b.created - a.created);
}

function libraryBreadcrumb() {
   const pack = db.packs.find((item) => item.id === lib.packId);
   const category = categoryById(lib.categoryId);
   if (lib.level === "category" && pack && category)
      return '<button class="lib-crumb" data-lib-go="packs">Mes mots</button><span>›</span><button class="lib-crumb" data-lib-go="pack">' + esc(pack.name) + '</button><span>›</span><strong>' + esc(category.name) + "</strong>";
   if (lib.level === "pack" && pack)
      return '<button class="lib-crumb" data-lib-go="packs">Mes mots</button><span>›</span><strong>' + esc(pack.name) + "</strong>";
   if (lib.level === "all")
      return '<button class="lib-crumb" data-lib-go="packs">Mes mots</button><span>›</span><strong>Tous les mots</strong>';
   return "";
}

function libraryHeaderHtml() {
   return '<header class="library-head"><div><p class="eyebrow">Bibliothèque personnelle</p><h2 class="v-t">库 · Mes mots</h2><p class="muted">Tes packs et ta progression, séparés du dictionnaire et des listes HSK.</p></div><button class="btn primary lib-import-main" id="lib-import">Importer un pack</button></header>' +
      (lib.level !== "packs" ? '<nav class="lib-breadcrumb" aria-label="Fil d’Ariane">' + libraryBreadcrumb() + "</nav>" : "");
}

function packTileHtml(pack, renderedAt) {
   const categories = categoriesForPack(pack.id);
   const cards = cardsForPack(pack.id);
   return '<article class="pack-tile"><button class="pack-open" data-pack-open="' + esc(pack.id) + '"><span class="pack-mark">册</span><span class="pack-copy"><strong>' + esc(pack.name) + '</strong><span>' + categories.length + ' sous-catégorie' + (categories.length > 1 ? "s" : "") + ' · ' + cards.length + ' mot' + (cards.length > 1 ? "s" : "") + '</span></span><span class="due-pill">' + dueCount(cards, renderedAt) + ' à revoir</span></button><div class="tile-actions"><button class="btn sm ghost" data-pack-review="' + esc(pack.id) + '">Réviser</button><button class="btn sm ghost" data-pack-export="' + esc(pack.id) + '">Exporter</button><button class="btn sm ghost" data-pack-rename="' + esc(pack.id) + '">Renommer</button><button class="btn sm danger" data-pack-delete="' + esc(pack.id) + '">Supprimer</button></div></article>';
}

function renderPackLibrary() {
   const root = $("view");
   const renderedAt = Date.now();
   const virtualData = libraryVirtualData(db.cards, renderedAt);
   root.innerHTML = '<section class="library-page">' + libraryHeaderHtml() +
      '<div class="library-toolbar"><button class="btn" id="lib-create-pack">Créer un pack</button><button class="btn ghost" id="lib-show-all">Voir tous les mots (' + db.cards.length + ')</button><button class="btn ghost" id="lib-export">Exporter</button></div>' +
      libraryVirtualSectionsHtml(virtualData) +
      (db.packs.length ? '<div class="pack-grid">' + db.packs.map((pack) => packTileHtml(pack, renderedAt)).join("") + "</div>" : '<div class="lib-empty card"><div class="pack-mark large">册</div><h3>Aucun pack</h3><p>Crée un pack ou importe directement un JSON. Tes anciennes cartes restent accessibles dans « Tous les mots ».</p></div>') +
      "</section>";
   wireLibraryCommon();
   wireLibraryVirtualSections(root, virtualData);
   $("lib-create-pack").onclick = () => {
      const name = prompt("Nom du nouveau pack :");
      const pack = createPersonalPack(name);
      if (pack) { lib.packId = pack.id; lib.level = "pack"; renderLib(); }
   };
   $("lib-show-all").onclick = () => { lib.level = "all"; lib.packId = ""; lib.categoryId = ""; lib.selected.clear(); renderLib(); };
   $("lib-export").onclick = openLibraryExportSheet;
   root.querySelectorAll("[data-pack-open]").forEach((button) => button.onclick = () => {
      lib.level = "pack"; lib.packId = button.dataset.packOpen; lib.categoryId = ""; lib.selected.clear(); renderLib();
   });
   root.querySelectorAll("[data-pack-review]").forEach((button) => button.onclick = () => openReviewForPack(button.dataset.packReview));
   root.querySelectorAll("[data-pack-export]").forEach((button) => button.onclick = () => {
      const pack = db.packs.find((item) => item.id === button.dataset.packExport);
      downloadJson(buildLibraryExport([pack.id]), "mo-studio-pack-" + flatten(pack.name) + ".json");
   });
   root.querySelectorAll("[data-pack-rename]").forEach((button) => button.onclick = () => {
      const pack = db.packs.find((item) => item.id === button.dataset.packRename);
      const name = prompt("Nouveau nom du pack :", pack.name);
      if (name && name.trim()) { pack.name = name.trim(); pack.updated = Date.now(); save(); renderLib(); }
   });
   root.querySelectorAll("[data-pack-delete]").forEach((button) => button.onclick = () => {
      const pack = db.packs.find((item) => item.id === button.dataset.packDelete);
      if (!confirm("Supprimer le pack « " + pack.name + " » et sa structure ? Les cartes resteront dans Mes mots.")) return;
      deletePersonalPack(pack.id); renderLib();
   });
}

function wireLibraryVirtualSections(root, data) {
   const groups = {
      favorites: data.favorites,
      due: data.dueNow,
      scheduled: data.scheduled,
      failed: data.failed,
      hard: data.hard,
   };
   root.querySelectorAll("[data-virtual-toggle]").forEach((button) => {
      button.onclick = () => {
         const kind = button.dataset.virtualToggle;
         const open = !libraryVirtualSections[kind];
         libraryVirtualSections[kind] = open;
         button.setAttribute("aria-expanded", String(open));
         const section = button.closest("[data-virtual-section]");
         section.classList.toggle("is-open", open);
         const content = $(button.getAttribute("aria-controls"));
         if (content) content.hidden = !open;
      };
   });
   root.querySelectorAll("[data-virtual-card]").forEach((button) => {
      button.onclick = () => {
         const cards = groups[button.dataset.virtualCardGroup] || [];
         openCardDetail(button.dataset.virtualCard, {
            cardIds: uniqueLibraryCards(cards).map((card) => card.id),
         });
      };
   });
   root.querySelectorAll("[data-virtual-review]").forEach((button) => {
      button.onclick = () => {
         const kind = button.dataset.virtualReview;
         const labels = {
            favorites: "Favoris",
            due: "À revoir maintenant",
            scheduled: "Toutes les cartes programmées",
            failed: "Derniers ratés",
            hard: "Dernières difficiles",
         };
         reviewLibraryCards(groups[kind] || [], labels[kind]);
      };
   });
   root.querySelectorAll("[data-virtual-list]").forEach((button) => {
      button.onclick = () => {
         lib.level = "all";
         lib.packId = "";
         lib.categoryId = "";
         lib.q = "";
         lib.flt = button.dataset.virtualList === "favorites" ? "fav" : "due";
         lib.selected.clear();
         renderLib();
      };
   });
}

function categoryTileHtml(category) {
   const cards = cardsForCategory(category.id);
   return '<article class="category-tile"><button class="category-open" data-category-open="' + esc(category.id) + '"><span><strong>' + esc(category.name) + '</strong><small>' + cards.length + ' mot' + (cards.length > 1 ? "s" : "") + ' · ' + dueCount(cards) + ' à revoir</small></span><span aria-hidden="true">›</span></button><div class="tile-actions"><button class="btn sm primary" data-category-review="' + esc(category.id) + '">Réviser</button><button class="btn sm ghost" data-category-rename="' + esc(category.id) + '">Renommer</button><button class="btn sm danger" data-category-delete="' + esc(category.id) + '">Supprimer</button></div></article>';
}

function renderPackDetail() {
   const root = $("view");
   const pack = db.packs.find((item) => item.id === lib.packId);
   if (!pack) { lib.level = "packs"; renderLib(); return; }
   const categories = categoriesForPack(pack.id);
   root.innerHTML = '<section class="library-page">' + libraryHeaderHtml() +
      '<div class="pack-detail-title"><div><h3>' + esc(pack.name) + '</h3>' + (pack.description ? '<p class="muted">' + esc(pack.description) + "</p>" : "") + '</div><div class="library-toolbar"><button class="btn primary" id="pack-review-all">Réviser ce pack</button><button class="btn" id="pack-add-category">Créer une sous-catégorie</button><button class="btn ghost" id="pack-add-word">Ajouter un mot</button></div></div>' +
      (categories.length ? '<div class="category-list">' + categories.map(categoryTileHtml).join("") + "</div>" : '<div class="lib-empty card"><h3>Ce pack n’a pas encore de sous-catégorie</h3><p>Crée par exemple « Chapitre 1 » pour commencer à l’organiser.</p></div>') +
      "</section>";
   wireLibraryCommon(); wireBreadcrumbs();
   $("pack-review-all").onclick = () => openReviewForPack(pack.id);
   $("pack-add-category").onclick = () => {
      const name = prompt("Nom de la sous-catégorie :");
      if (createPersonalCategory(pack.id, name)) renderLib();
   };
   $("pack-add-word").onclick = () => openCardForm(null, categories.map((category) => category.id));
   root.querySelectorAll("[data-category-open]").forEach((button) => button.onclick = () => {
      lib.level = "category"; lib.categoryId = button.dataset.categoryOpen; lib.selected.clear(); renderLib();
   });
   root.querySelectorAll("[data-category-review]").forEach((button) => button.onclick = () => {
      const category = categoryById(button.dataset.categoryReview);
      openReviewForCategory(category.id);
   });
   root.querySelectorAll("[data-category-rename]").forEach((button) => button.onclick = () => {
      const category = categoryById(button.dataset.categoryRename);
      const name = prompt("Nouveau nom :", category.name);
      if (name && name.trim()) { category.name = name.trim(); category.updated = Date.now(); save(); renderLib(); }
   });
   root.querySelectorAll("[data-category-delete]").forEach((button) => button.onclick = () => {
      const category = categoryById(button.dataset.categoryDelete);
      if (!confirm("Supprimer la sous-catégorie « " + category.name + " » ? Les cartes resteront dans Mes mots.")) return;
      deletePersonalCategory(category.id); renderLib();
   });
}

function wordRowHtml(card) {
   const checked = lib.selected.has(card.id);
   return '<div class="word-select-row"><label class="word-check"><input type="checkbox" data-word-check="' + esc(card.id) + '"' + (checked ? " checked" : "") + '><span class="sr-only">Sélectionner ' + esc(card.hz) + '</span></label><button class="word-open" data-word-open="' + esc(card.id) + '"><span class="row-hz">' + esc(card.hz) + '</span><span class="row-mid"><span class="row-py">' + (card.py ? colorPinyin(card.py) : '<em>pinyin manquant</em>') + '</span><span class="row-fr">' + (card.fr ? esc(card.fr) : '<em>traduction manquante</em>') + '</span></span><span class="row-badges">' + (card.fav ? '<i class="b red">Favori</i>' : "") + (card.difficult ? '<i class="b gold">Difficile</i>' : "") + (isDue(card) ? '<i class="b gold">Due</i>' : "") + (card.acquired ? '<i class="b jade">Maîtrisé</i>' : "") + (card.incomplete ? '<i class="b">Incomplet</i>' : "") + "</span></button></div>";
}

function filterChip(value, label) {
   return '<button class="chip" data-lib-filter="' + value + '" aria-pressed="' + String(lib.flt === value) + '">' + label + "</button>";
}

function renderWordList() {
   const root = $("view");
   const cards = libraryFilteredCards();
   const scope = libraryScopeCards();
   const category = categoryById(lib.categoryId);
   const title = category ? category.name : "Tous les mots";
   root.innerHTML = '<section class="library-page">' + libraryHeaderHtml() +
      '<div class="word-list-title"><div><h3>' + esc(title) + '</h3><p class="muted">' + scope.length + ' carte' + (scope.length > 1 ? "s" : "") + ' dans cette vue</p></div><div class="library-toolbar">' + (category ? '<button class="btn primary" id="category-review">Réviser cette sous-catégorie</button>' : "") + '<button class="btn" id="word-add">Ajouter un mot</button></div></div>' +
      '<div class="word-tools card"><input class="search" id="lib-search" value="' + esc(lib.q) + '" placeholder="Rechercher un mot, un sens ou un tag"><div class="chips">' + filterChip("all", "Tous") + filterChip("due", "À revoir") + filterChip("fav", "Favoris") + filterChip("difficult", "Difficiles") + filterChip("new", "Nouveaux") + filterChip("mastered", "Maîtrisés") + '</div><div class="selection-tools"><button class="btn sm ghost" data-select-mode="all">Tout sélectionner</button><button class="btn sm ghost" data-select-mode="none">Tout désélectionner</button><button class="btn sm ghost" data-select-mode="due">Seulement dues</button><button class="btn sm ghost" data-select-mode="new">Seulement nouvelles</button></div></div>' +
      '<div class="bulk-bar"' + (lib.selected.size ? "" : " hidden") + '><strong>' + lib.selected.size + ' sélectionnée' + (lib.selected.size > 1 ? "s" : "") + '</strong><button class="btn sm primary" id="selected-review">Réviser</button><button class="btn sm" id="selected-move">Déplacer / ajouter</button><button class="btn sm danger" id="selected-delete">Supprimer</button></div>' +
      '<div class="word-list" id="lib-list">' + (cards.length ? cards.map(wordRowHtml).join("") : '<p class="lib-no-results">Aucun mot ne correspond à cette sélection.</p>') + '</div></section>';
   wireLibraryCommon(); wireBreadcrumbs(); wireWordList(cards);
   if ($("category-review")) $("category-review").onclick = () => openReviewForCategory(category.id);
   $("word-add").onclick = () => openCardForm(null, category ? [category.id] : []);
}

function wireWordList(visibleCards) {
   $("lib-search").oninput = (event) => { lib.q = event.target.value; renderWordList(); };
   document.querySelectorAll("[data-lib-filter]").forEach((button) => button.onclick = () => { lib.flt = button.dataset.libFilter; renderWordList(); });
   document.querySelectorAll("[data-word-check]").forEach((input) => input.onchange = () => {
      if (input.checked) lib.selected.add(input.dataset.wordCheck); else lib.selected.delete(input.dataset.wordCheck);
      renderWordList();
   });
   const detailContext = { cardIds: visibleCards.map((card) => card.id) };
   document.querySelectorAll("[data-word-open]").forEach((button) => button.onclick = () =>
      openCardDetail(button.dataset.wordOpen, detailContext),
   );
   document.querySelectorAll("[data-select-mode]").forEach((button) => button.onclick = () => {
      if (button.dataset.selectMode === "none") lib.selected.clear();
      else {
         const picked = button.dataset.selectMode === "due" ? visibleCards.filter(isDue) : button.dataset.selectMode === "new" ? visibleCards.filter((card) => card.due == null && !card.acquired) : visibleCards;
         lib.selected = new Set(picked.map((card) => card.id));
      }
      renderWordList();
   });
   if ($("selected-review")) $("selected-review").onclick = () => reviewLibraryCards(db.cards.filter((card) => lib.selected.has(card.id)), "Sélection manuelle");
   if ($("selected-delete")) $("selected-delete").onclick = () => {
      if (!confirm("Supprimer définitivement " + lib.selected.size + " carte(s) personnelle(s) ?")) return;
      removeCardsFromLibrary(Array.from(lib.selected)); lib.selected.clear(); renderLib();
   };
   if ($("selected-move")) $("selected-move").onclick = openMoveSelectedSheet;
}

function wireBreadcrumbs() {
   document.querySelectorAll("[data-lib-go]").forEach((button) => button.onclick = () => {
      if (button.dataset.libGo === "packs") { lib.level = "packs"; lib.packId = ""; lib.categoryId = ""; }
      else { lib.level = "pack"; lib.categoryId = ""; }
      lib.selected.clear(); renderLib();
   });
}

function wireLibraryCommon() {
   if ($("lib-import")) $("lib-import").onclick = openPackImportSheet;
}

function renderLib() {
   ensurePersonalLibraryShape();
   if (lib.level === "pack") renderPackDetail();
   else if (lib.level === "category" || lib.level === "all") renderWordList();
   else renderPackLibrary();
}

function reviewLibraryCards(cards, label) {
   const requestedIds = new Set(uniqueLibraryCards(cards).map((card) => card.id));
   const selectedCards = db.cards.filter((card) => requestedIds.has(card.id));
   if (!selectedCards.length) { toast("Aucune carte dans cette sélection."); return; }
   reviewExtraFilters = {
      newOnly: false,
      favoritesOnly: false,
      difficultOnly: false,
      includeLearned: true,
   };
   openReviewForManualCards(selectedCards, label);
}

function openMoveSelectedSheet() {
   const current = lib.categoryId;
   openSheet('<h3 class="sh-t">Déplacer ou ajouter</h3><p class="sh-p">Choisis la destination pour les ' + lib.selected.size + ' mots sélectionnés.</p><label class="f-lab">Sous-catégorie<select class="search" id="move-target">' + db.packs.map((pack) => '<optgroup label="' + esc(pack.name) + '">' + categoriesForPack(pack.id).map((category) => '<option value="' + esc(category.id) + '">' + esc(category.name) + "</option>").join("") + "</optgroup>").join("") + '</select></label><label class="ck"><input type="checkbox" id="move-copy" checked> Conserver aussi l’appartenance actuelle</label><div class="sh-btns"><button class="btn primary" id="move-confirm">Confirmer</button><button class="btn ghost" data-sheet-close>Annuler</button></div>');
   $("move-confirm").onclick = () => {
      const target = $("move-target").value;
      if (!target) return;
      lib.selected.forEach((cardId) => addCardMembership(cardId, target));
      if (!$("move-copy").checked && current && current !== target)
         db.memberships = db.memberships.filter((membership) => !(membership.categoryId === current && lib.selected.has(membership.cardId)));
      syncLegacyPackCardIds(); save(); closeSheet(); renderLib(); toast("Appartenances mises à jour.");
   };
}

function cardCategoryCheckboxes(card, checkedIds) {
   const checked = new Set(checkedIds || (card ? categoriesForCard(card.id).map((category) => category.id) : []));
   if (!db.packs.length) return '<p class="sh-note">Crée d’abord un pack et une sous-catégorie pour classer ce mot.</p>';
   return '<div class="category-check-groups">' + db.packs.map((pack) => '<fieldset><legend>' + esc(pack.name) + '</legend>' + (categoriesForPack(pack.id).map((category) => '<label class="ck"><input type="checkbox" data-card-category="' + esc(category.id) + '"' + (checked.has(category.id) ? " checked" : "") + '> ' + esc(category.name) + "</label>").join("") || '<span class="sh-note">Aucune sous-catégorie</span>') + "</fieldset>").join("") + "</div>";
}

function cardDetailContext(id, options) {
   const requestedIds = options && Array.isArray(options.cardIds) ? options.cardIds : [id];
   const existingIds = new Set(db.cards.map((card) => card.id));
   const cardIds = Array.from(new Set(requestedIds)).filter((cardId) => existingIds.has(cardId));
   return { cardIds: cardIds.includes(id) ? cardIds : [id] };
}

function cardDetailWordNavigationHtml(card, context) {
   if (context.cardIds.length <= 1) return "";
   const index = context.cardIds.indexOf(card.id);
   return (
      '<div class="card-detail-word-nav">' +
      '<strong class="card-detail-word-position" id="card-word-position" role="status" aria-live="polite">' +
      esc(card.hz) + " · " + (index + 1) + " / " + context.cardIds.length + "</strong>" +
      "</div>"
   );
}

function wireCardStrokeWorkspace(card, characters, context, initialCharacterIndex) {
   if (!characters.length) return;
   wireStrokeWorkspace();
   let selectedIndex = 0;
   const listIndex = context.cardIds.indexOf(card.id);
   const selectCharacter = (index) => {
      selectedIndex = Math.max(0, Math.min(Number(index) || 0, characters.length - 1));
      const character = characters[selectedIndex];
      updateCharacterNavigation("card", characters, selectedIndex);
      if ($("card-prev"))
         $("card-prev").disabled = selectedIndex === 0 && listIndex === 0;
      if ($("card-next"))
         $("card-next").disabled =
            selectedIndex === characters.length - 1 && listIndex === context.cardIds.length - 1;
      loadDDChar(character, characters, {
         workspace: $("card-stage"),
         selectionKey: `card:${card.id}:${selectedIndex}:${character}`,
         selectionIndex: selectedIndex,
      });
   };
   if ($("card-prev")) $("card-prev").onclick = () => {
      if (selectedIndex > 0) selectCharacter(selectedIndex - 1);
      else if (listIndex > 0)
         openCardDetail(context.cardIds[listIndex - 1], {
            ...context,
            initialCharacterIndex: -1,
         });
   };
   if ($("card-next")) $("card-next").onclick = () => {
      if (selectedIndex < characters.length - 1) selectCharacter(selectedIndex + 1);
      else if (listIndex < context.cardIds.length - 1)
         openCardDetail(context.cardIds[listIndex + 1], {
            ...context,
            initialCharacterIndex: 0,
         });
   };
   const startIndex = initialCharacterIndex === -1
      ? characters.length - 1
      : initialCharacterIndex == null ? 0 : initialCharacterIndex;
   selectCharacter(startIndex);
}

function openCardDetail(id, options) {
   const card = db.cards.find((item) => item.id === id);
   if (!card) return;
   const context = cardDetailContext(id, options);
   const initialCharacterIndex = options && options.initialCharacterIndex;
   const characters = Array.from(card.hz || "").filter((character) => HAN_PATTERN.test(character));
   resetStrokeAutoplaySelection();
   openSheet(
      '<article class="card-detail-sheet" data-card-id="' + esc(card.id) + '">' +
      '<div class="cd-head"><div><div class="cd-hz" data-say="' + esc(card.hz) + '">' +
      esc(card.hz) + '</div><div class="cd-py">' +
      (card.py ? colorPinyin(card.py) : "Pinyin manquant") + '</div><div class="cd-fr">' +
      (esc(card.fr) || "Traduction manquante") +
      '</div></div><div class="dd-top-actions"><button class="seal" data-say="' +
      esc(card.hz) + '" aria-label="Écouter">听</button>' +
      '<button class="dd-top-close" id="card-close-top" data-sheet-close aria-label="Fermer la fiche">×</button></div></div>' +
      cardDetailWordNavigationHtml(card, context) +
      (characters.length
         ? '<section class="dd-character-interaction card-detail-strokes" id="card-stroke-interaction"><div class="eyebrow">Ordre des traits</div>' +
           strokeCharacterStageHtml(
              "card",
              characters[0],
              0,
              characters.length,
              context.cardIds.length > 1,
           ) + "</section>"
         : "") +
      '<div class="acts"><button class="act' + (card.fav ? " on" : "") +
      '" id="card-favorite">Favori</button><button class="act' +
      (card.difficult ? " on" : "") +
      '" id="card-difficult">Difficile</button><button class="act' +
      (card.acquired ? " on jade" : "") + '" id="card-mastered">Maîtrisé</button></div>' +
      (card.note ? '<div class="note">' + esc(card.note) + "</div>" : "") +
      '<div class="eyebrow">Présent dans</div>' + cardCategoryCheckboxes(card) +
      '<div class="sh-btns"><button class="btn primary" id="card-review-one">Réviser</button><button class="btn" id="card-edit">Modifier</button><button class="btn danger" id="card-delete">Supprimer</button><button class="btn ghost" id="card-close" data-sheet-close>Fermer</button></div></article>',
   );
   wireCardStrokeWorkspace(card, characters, context, initialCharacterIndex);
   $("card-favorite").onclick = () => {
      card.fav = !card.fav;
      card.updated = Date.now();
      save();
      if (activeView === "lib" && lib.level === "packs") renderPackLibrary();
      openCardDetail(id, context);
   };
   $("card-difficult").onclick = () => { card.difficult = !card.difficult; card.updated = Date.now(); save(); openCardDetail(id, context); };
   $("card-mastered").onclick = () => { card.acquired = !card.acquired; if (card.acquired) card.due = null; card.updated = Date.now(); save(); openCardDetail(id, context); };
   document.querySelectorAll("[data-card-category]").forEach((input) => input.onchange = () => {
      if (input.checked) addCardMembership(card.id, input.dataset.cardCategory);
      else db.memberships = db.memberships.filter((membership) => !(membership.cardId === card.id && membership.categoryId === input.dataset.cardCategory));
      syncLegacyPackCardIds(); save();
   });
   $("card-review-one").onclick = () => { closeSheet(); reviewLibraryCards([card], "Mot · " + card.hz); };
   $("card-edit").onclick = () => openCardForm(card);
   $("card-delete").onclick = () => { if (confirm("Supprimer définitivement « " + card.hz + " » ?")) { removeCardsFromLibrary([card.id]); closeSheet(); lib.selected.delete(card.id); renderLib(); } };
}

let cardDictionarySearchTimer = null;
let cardDictionarySearchSequence = 0;

function personalCardForDictionarySelection(entry) {
   if (typeof findPersonalCardForEntry === "function")
      return findPersonalCardForEntry(entry);
   if (entry && entry.personalCard)
      return db.cards.find((card) => card.id === entry.personalCard.id) || null;
   const sourceId = entry && (entry.dictionaryEntryId || entry.id);
   return sourceId
      ? db.cards.find((card) => card.dictionaryEntryId === sourceId) || null
      : null;
}

async function dictionaryEntryWithAllFrenchSenses(entry) {
   if (!entry || !entry.id || typeof loadDictionaryEntryById !== "function") return entry;
   try {
      const full = await loadDictionaryEntryById(entry.id);
      return full ? { ...entry, ...full } : entry;
   } catch (error) {
      console.error("Chargement des sens complets impossible", error);
      return entry;
   }
}

function dictionaryEntryCardDraft(entry) {
   const existing = personalCardForDictionarySelection(entry);
   return {
      hz: existing ? existing.hz : entry.simplified,
      py: existing ? existing.py : (entry.pinyin && entry.pinyin[0] ? entry.pinyin[0].marked : ""),
      fr: existing ? existing.fr : dictionaryCompletionTranslation(entry),
      note: existing ? existing.note : "",
      tags: existing ? existing.tags : [],
      senseId: existing ? existing.senseId : "",
      traditional: existing ? existing.traditional : entry.traditional || "",
      dictionaryEntryId: existing && existing.dictionaryEntryId
         ? existing.dictionaryEntryId
         : entry.dictionaryEntryId || entry.id || "",
   };
}

function dictionarySelectionHtml(entry, existing) {
   const definition = dictionaryResultDefinition(entry);
   const translation = dictionaryCompletionTranslation(entry) || definition.text;
   return (
      '<section class="word-dictionary-choice" aria-label="Entrée du dictionnaire choisie"><div class="word-dictionary-choice-main"><b>' +
      esc(entry.simplified) + '</b><span>' + colorPinyin(dictionaryEntryPinyinText(entry)) +
      '</span><small>' + (definition.english ? "EN · " : "") + esc(translation) + "</small></div>" +
      (existing ? '<span class="word-dictionary-existing">Déjà dans Mes mots</span>' : "") +
      '<button class="btn ghost sm" id="word-change-dictionary" type="button">Changer de mot</button></section>'
   );
}

function cardEditorHtml(existingCard, current, initialCategoryIds, creationState) {
   const selectedEntry = creationState && creationState.entry;
   const selectedExisting = selectedEntry && personalCardForDictionarySelection(selectedEntry);
   return (
      '<h3 class="sh-t">' + (existingCard ? "Modifier le mot" : "Ajouter un mot") + "</h3>" +
      (selectedEntry ? dictionarySelectionHtml(selectedEntry, selectedExisting) : "") +
      (!existingCard && creationState && creationState.mode === "manual"
         ? '<div class="word-manual-heading"><p><strong>Création manuelle</strong><span>Renseigne uniquement ce que tu connais.</span></p><button class="btn ghost sm" id="word-back-dictionary" type="button">Chercher dans le dictionnaire</button></div>'
         : "") +
      '<div class="word-card-fields"><label class="f-lab">Caractères chinois *<input class="search" id="word-hz" value="' + esc(current.hz || "") + '"></label><label class="f-lab">Pinyin<input class="search" id="word-py" value="' + esc(current.py || "") + '"></label><label class="f-lab">Traduction<input class="search" id="word-fr" value="' + esc(current.fr || "") + '"></label><label class="f-lab">Notes<textarea class="search" id="word-note" rows="2">' + esc(current.note || "") + '</textarea></label><label class="f-lab">Tags, séparés par des virgules<input class="search" id="word-tags" value="' + esc((current.tags || []).join(", ")) + '"></label></div><div class="eyebrow">Sous-catégories</div>' +
      cardCategoryCheckboxes(existingCard, initialCategoryIds) +
      '<div class="sh-btns"><button class="btn primary" id="word-save">' + (selectedExisting ? "Ranger le mot" : "Enregistrer") + '</button><button class="btn ghost" data-sheet-close>Annuler</button></div>'
   );
}

function openCardDictionarySearch(initialCategoryIds, state) {
   clearTimeout(cardDictionarySearchTimer);
   const searchState = state || { suggestionSearch: null, suggestionIndex: -1, query: "" };
   openSheet(
      '<section class="word-dictionary-search"><h3 class="sh-t">Ajouter un mot</h3><p class="sh-p">Commence par le dictionnaire : pinyin et traduction seront préremplis.</p>' +
      '<label class="f-lab" for="word-dictionary-query">Chercher un mot dans le dictionnaire</label><div class="dictionary-search-input word-dictionary-input"><input class="search" id="word-dictionary-query" value="' + esc(searchState.query || "") + '" placeholder="汉字, pinyin ou français…" autocomplete="off" autocapitalize="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="word-dictionary-suggestions" aria-expanded="false"><button type="button" class="search-clear" id="word-dictionary-clear" aria-label="Effacer"' + (searchState.query ? "" : " hidden") + '>×</button><div class="dictionary-suggestions" id="word-dictionary-suggestions" role="listbox" hidden></div></div>' +
      '<div class="search-live-state" id="word-dictionary-state" role="status" aria-live="polite">Saisis un caractère chinois ou au moins deux lettres.</div>' +
      '<button class="btn ghost wide word-manual-start" id="word-manual-start" type="button">Ce mot n’est pas dans le dictionnaire — le créer à la main</button>' +
      '<div class="sh-btns"><button class="btn ghost" data-sheet-close>Annuler</button></div></section>',
   );
   const input = $("word-dictionary-query");
   const suggestionOptions = {
      target: "word-dictionary-suggestions",
      input,
      state: searchState,
      idPrefix: "word-dictionary-option",
      onSelect: async (entry) => {
         if ($("word-dictionary-state")) $("word-dictionary-state").textContent = "Préparation du mot…";
         let completedEntry = await dictionaryEntryWithAllFrenchSenses(entry);
         try {
            if (typeof dictionaryEntryWithFrenchSibling === "function")
               completedEntry = await dictionaryEntryWithFrenchSibling(completedEntry);
         } catch (error) {
            console.error("Complétion française de la suggestion impossible", error);
         }
         if (!$("word-dictionary-query")) return;
         openCardForm(null, initialCategoryIds, {
            mode: "selected",
            entry: completedEntry,
            draft: dictionaryEntryCardDraft(completedEntry),
            query: input.value,
         });
      },
      isAlreadyPersonal: (entry) => !!personalCardForDictionarySelection(entry),
   };
   const openManual = () => {
      const typed = input.value.trim();
      const isHanzi = typed && Array.from(typed).every((character) => HAN_PATTERN.test(character));
      openCardForm(null, initialCategoryIds, {
         mode: "manual",
         draft: { hz: isHanzi ? typed : "", py: "", fr: "", note: "", tags: [] },
         query: input.value,
      });
   };
   const updateSuggestions = async () => {
      if (!input.isConnected) return;
      const expected = input.value.trim();
      searchState.query = input.value;
      const classified = classifySearchQuery(expected);
      const minimum = classified.type && classified.type.startsWith("hanzi") ? 1 : 2;
      if (!classified.valid || Array.from(expected).length < minimum) {
         closeSearchSuggestions(suggestionOptions);
         $("word-dictionary-state").textContent = "Saisis un caractère chinois ou au moins deux lettres.";
         return;
      }
      const sequence = ++cardDictionarySearchSequence;
      $("word-dictionary-state").textContent = "Recherche dans le dictionnaire…";
      try {
         const response = await searchDictionary(expected, { limit: 6, candidateLimit: 18 });
         if (sequence !== cardDictionarySearchSequence || !$("word-dictionary-query") || input.value.trim() !== expected) return;
         const items = renderSearchSuggestions(response, {
            ...suggestionOptions,
            emptyHtml: '<div class="word-dictionary-empty"><p>Aucun résultat pour <strong>« ' + esc(expected) + ' »</strong>.</p><button class="btn ghost" id="word-manual-empty" type="button">Créer ce mot à la main</button></div>',
         });
         $("word-dictionary-state").textContent = items.length
            ? items.length + " suggestion" + (items.length > 1 ? "s" : "")
            : "Ce mot semble absent du dictionnaire.";
         if ($("word-manual-empty")) $("word-manual-empty").onclick = openManual;
      } catch (error) {
         if (error instanceof StaleDictionarySearchError) return;
         if ($("word-dictionary-state")) $("word-dictionary-state").textContent = "Dictionnaire indisponible. La création manuelle reste possible.";
      }
   };
   input.oninput = () => {
      searchState.query = input.value;
      searchState.suggestionSearch = null;
      searchState.suggestionIndex = -1;
      closeSearchSuggestions(suggestionOptions);
      $("word-dictionary-clear").hidden = !input.value;
      clearTimeout(cardDictionarySearchTimer);
      cardDictionarySearchTimer = setTimeout(updateSuggestions, SEARCH_DEBOUNCE_MS);
   };
   input.onkeydown = (event) => {
      if (event.key === "ArrowDown" && moveSearchSuggestion(1, suggestionOptions)) event.preventDefault();
      else if (event.key === "ArrowUp" && moveSearchSuggestion(-1, suggestionOptions)) event.preventDefault();
      else if (event.key === "Enter" && searchState.suggestionSearch) {
         const index = searchState.suggestionIndex < 0 ? 0 : searchState.suggestionIndex;
         const item = searchState.suggestionSearch.results[index];
         if (item) { event.preventDefault(); suggestionOptions.onSelect(item.entry); }
      } else if (event.key === "Escape" && !$("word-dictionary-suggestions").hidden) {
         event.preventDefault();
         event.stopPropagation();
         closeSearchSuggestions(suggestionOptions);
      }
   };
   $("word-dictionary-clear").onclick = () => {
      input.value = "";
      searchState.query = "";
      $("word-dictionary-clear").hidden = true;
      closeSearchSuggestions(suggestionOptions);
      $("word-dictionary-state").textContent = "Saisis un caractère chinois ou au moins deux lettres.";
      input.focus();
   };
   $("word-manual-start").onclick = openManual;
   if (searchState.query) updateSuggestions();
   else requestAnimationFrame(() => requestAnimationFrame(() => {
      if (input.isConnected) input.focus({ preventScroll: true });
   }));
}

function openCardForm(card, initialCategoryIds, creationState) {
   clearTimeout(cardDictionarySearchTimer);
   const existingCard = card && db.cards.find((item) => item.id === card.id);
   if (!existingCard && !card && !creationState)
      return openCardDictionarySearch((initialCategoryIds || []).slice());
   const current = creationState && creationState.draft ? creationState.draft : card || {};
   openSheet(cardEditorHtml(existingCard, current, initialCategoryIds, creationState));
   const returnToSearch = () => openCardDictionarySearch((initialCategoryIds || []).slice(), {
      suggestionSearch: null,
      suggestionIndex: -1,
      query: creationState && creationState.query ? creationState.query : "",
   });
   if ($("word-change-dictionary")) $("word-change-dictionary").onclick = returnToSearch;
   if ($("word-back-dictionary")) $("word-back-dictionary").onclick = returnToSearch;
   $("word-save").onclick = async () => {
      const chinese = $("word-hz").value.trim();
      if (!chinese) { toast("Les caractères chinois sont obligatoires."); return; }
      let pinyin = $("word-py").value.trim(); let translation = $("word-fr").value.trim();
      let dictionaryEntryId = current.dictionaryEntryId || "";
      if (!pinyin || !translation) { const match = await dictionaryCompletion(chinese, pinyin); if (match) { pinyin ||= match.pinyin; translation ||= match.translation; dictionaryEntryId ||= match.dictionaryId; } }
      const candidate = { hz: chinese, py: pinyin, fr: translation, senseId: current.senseId || "", dictionaryEntryId, traditional: current.traditional || "" };
      const selectedExisting = creationState && creationState.entry
         ? personalCardForDictionarySelection(creationState.entry)
         : null;
      const duplicate = selectedExisting || db.cards.find((item) => item.id !== (existingCard && existingCard.id) && personalCardEquivalent(item, candidate));
      const saved = existingCard || duplicate || normalizeCard(candidate, false);
      saved.hz = chinese; saved.py = pinyin; saved.fr = translation; saved.note = $("word-note").value.trim(); saved.tags = $("word-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean); saved.incomplete = !pinyin || !translation; saved.dictionaryEntryId = dictionaryEntryId || saved.dictionaryEntryId || ""; saved.traditional = current.traditional || saved.traditional || ""; saved.updated = Date.now();
      if (!existingCard && !duplicate) db.cards.push(saved);
      const checked = new Set(Array.from(document.querySelectorAll("[data-card-category]:checked")).map((input) => input.dataset.cardCategory));
      if (existingCard) db.memberships = db.memberships.filter((membership) => membership.cardId !== saved.id || checked.has(membership.categoryId));
      checked.forEach((categoryId) => addCardMembership(saved.id, categoryId));
      syncLegacyPackCardIds(); invalidateDictIndex(); save(); closeSheet(); renderLib(); toast(duplicate ? "Mot existant ajouté aux sous-catégories." : "Mot enregistré.");
   };
}

function openPacksSheet() {
   closeSheet(); lib.level = "packs"; lib.packId = ""; lib.categoryId = ""; setView("lib");
}

function openPackImportSheet() {
   openSheet('<h3 class="sh-t">Importer un pack</h3><p class="sh-p">Le JSON est recommandé. Tu peux aussi choisir un CSV simple ou coller un JSON généré par ChatGPT.</p><div class="import-source-grid"><button class="btn primary" id="import-json-file">Choisir un fichier JSON</button><button class="btn" id="import-csv-file">Choisir un fichier CSV</button><button class="btn ghost" id="import-example">Voir un exemple JSON</button></div><label class="f-lab">Coller du JSON<textarea class="search import-paste" id="import-paste" rows="9" placeholder="{ &quot;version&quot;: 1, … }"></textarea></label><div class="sh-btns"><button class="btn primary" id="import-paste-preview">Prévisualiser le JSON collé</button><button class="btn ghost" data-sheet-close>Annuler</button></div><input type="file" id="pack-file-json" accept=".json,application/json" hidden><input type="file" id="pack-file-csv" accept=".csv,text/csv" hidden>');
   $("import-json-file").onclick = () => $("pack-file-json").click();
   $("import-csv-file").onclick = () => $("pack-file-csv").click();
   $("import-example").onclick = openPackExampleSheet;
   $("import-paste-preview").onclick = () => previewPackImportText($("import-paste").value, "json");
   $("pack-file-json").onchange = (event) => readPackImportFile(event.target.files[0], "json");
   $("pack-file-csv").onchange = (event) => readPackImportFile(event.target.files[0], "csv");
}

function readPackImportFile(file, type) {
   if (!file) return;
   const reader = new FileReader();
   reader.onload = () => previewPackImportText(String(reader.result || ""), type);
   reader.onerror = () => toast("Impossible de lire ce fichier.");
   reader.readAsText(file);
}

async function previewPackImportText(text, type) {
   try {
      const payload = type === "csv" ? csvToPackPayload(text) : parsePackJson(text);
      openSheet('<h3 class="sh-t">Analyse de l’import</h3><p class="sh-p">Vérification de la structure et du dictionnaire…</p><div class="import-loading" aria-label="Chargement"></div>');
      const preview = await buildPackImportPreview(payload, type);
      openPackImportPreview(preview);
   } catch (error) {
      openSheet('<h3 class="sh-t">Import impossible</h3><div class="import-error" role="alert">' + esc(error.message) + '</div><div class="sh-btns"><button class="btn ghost" id="import-back">Retour</button></div>');
      $("import-back").onclick = openPackImportSheet;
   }
}

function packImportPreviewSummaryHtml(preview, names) {
   const words = preview.wordCount + " mot" + (preview.wordCount === 1 ? "" : "s");
   const categories = preview.categoryCount + " sous-catégorie" + (preview.categoryCount === 1 ? "" : "s");
   let existingSentence = "Ils seront ajoutés à ta bibliothèque.";
   if (preview.existing) {
      const subject = preview.existing === 1 ? "1 est déjà dans ta bibliothèque" : preview.existing + " sont déjà dans ta bibliothèque";
      const reuse = preview.existing === 1 ? "il sera réutilisé et sa progression est conservée" : "ils seront réutilisés et leur progression est conservée";
      existingSentence = subject + " : " + reuse + ".";
   }
   const chips = [
      '<span class="import-summary-chip">' + words + "</span>",
      '<span class="import-summary-chip">' + categories + "</span>",
      preview.existing ? '<span class="import-summary-chip">' + preview.existing + " déjà présent" + (preview.existing > 1 ? "s" : "") + "</span>" : "",
   ].filter(Boolean).join("");
   const notices = [
      preview.duplicates ? "Le fichier contient " + preview.duplicates + " doublon" + (preview.duplicates > 1 ? "s" : "") + " : " + (preview.duplicates > 1 ? "ils seront fusionnés" : "il sera fusionné") + " automatiquement." : "",
   ].filter(Boolean);
   return (
      '<section class="import-preview-summary" aria-label="Résumé de l’import"><p class="import-summary-sentence"><strong>' +
      words + " dans « " + esc(names) + " »</strong> (" + categories + "). " + esc(existingSentence) +
      '</p><div class="import-summary-chips">' + chips + "</div>" +
      (notices.length ? '<div class="import-preview-notices">' + notices.map((notice) => "<p>" + esc(notice) + "</p>").join("") + "</div>" : "") +
      "</section>"
   );
}

function openPackImportPreview(preview) {
   const names = preview.packs.map((pack) => pack.name).join(", ") || "Sans nom";
   const previewWords = preview.packs.flatMap((pack) =>
      pack.categories.flatMap((category) => category.words),
   );
   const uniquePreviewWords = previewWords.filter((word) => !word.duplicateOf);
   const unknownWords = uniquePreviewWords.filter((word) => !word.dictionaryId || word.incomplete);
   const unknownCount = unknownWords.length;
   const unknownExamples = Array.from(
      new Set(unknownWords.map((word) => word.chinese).filter(Boolean)),
   ).slice(0, 2);
   const newModeLabel = preview.packs.length === 1
      ? "Créer un nouveau pack « " + names + " »"
      : "Créer " + preview.packs.length + " nouveaux packs";
   const errors = preview.errors.length
      ? '<div class="import-error" role="alert"><strong>Ce fichier ne peut pas être importé tel quel :</strong><span>Erreurs de structure</span><ul>' + preview.errors.map((error) => '<li>' + esc(error) + "</li>").join("") + "</ul></div>"
      : "";
   const options = preview.errors.length ? "" :
      '<fieldset class="import-options"><legend>Comment veux-tu importer ?</legend><div class="import-mode-choices">' +
      '<label class="import-mode-choice"><input type="radio" name="import-mode" value="new" checked><span><strong>' + esc(newModeLabel) + '</strong><small>Un pack séparé sera ajouté à ta bibliothèque.</small></span></label>' +
      '<label class="import-mode-choice"><input type="radio" name="import-mode" value="merge"><span><strong>Ajouter à un pack que j’ai déjà</strong><small>Les mots seront rangés dans un pack existant.</small></span></label></div>' +
      '<label class="import-target-field" id="import-target-field" for="import-target" hidden><span>Dans quel pack ?</span><select class="search" id="import-target"><option value="">Choisir un pack existant</option>' + db.packs.map((pack) => '<option value="' + esc(pack.id) + '">' + esc(pack.name) + "</option>").join("") + "</select></label>" +
      '<section class="import-structure" id="import-replace-field" aria-labelledby="import-structure-question" hidden><p class="import-structure-question" id="import-structure-question"></p><div class="import-structure-choices">' +
      '<label class="import-structure-choice"><input type="radio" name="import-structure" value="keep" checked><span><strong>Ajouter aux sous-catégories existantes</strong><small id="import-structure-keep-help"></small></span></label>' +
      '<label class="import-structure-choice import-structure-choice-danger"><input type="radio" name="import-structure" value="replace"><span><strong>Remplacer l’organisation par celle du fichier</strong><small id="import-structure-replace-help"></small></span></label>' +
      "</div></section>" +
      (preview.missingDictionary + preview.incomplete > 0
         ? '<fieldset class="import-unknown-words" id="import-unknown-words"><legend>Mots inconnus</legend><p><strong>' +
           unknownCount + " mot" + (unknownCount > 1 ? "s" : "") +
           " du fichier " + (unknownCount > 1 ? "ne sont" : "n’est") +
           " pas dans le dictionnaire de l’appli" +
           (unknownExamples.length ? " (exemple" + (unknownExamples.length > 1 ? "s" : "") + " : " + unknownExamples.map(esc).join(", ") + ")" : "") +
           '. Que faire ?</strong></p><div class="import-unknown-choices">' +
           '<label class="import-unknown-choice"><input type="radio" name="import-missing" value="yes" checked><span><strong>Les importer quand même</strong><small>Ils auront juste leurs caractères ; tu pourras ajouter pinyin et traduction toi-même plus tard.</small></span></label>' +
           '<label class="import-unknown-choice"><input type="radio" name="import-missing" value="no"><span><strong>Les laisser de côté</strong><small id="import-recognized-count"></small></span></label>' +
           "</div></fieldset>"
         : "") +
      "</fieldset>";
   openSheet('<article class="pack-import-preview"><h3 class="sh-t">Aperçu avant import</h3><p class="sh-p">Source ' + preview.sourceType.toUpperCase() + "</p>" + packImportPreviewSummaryHtml(preview, names) + errors + options + '<div class="sh-btns">' + (preview.errors.length ? "" : '<button class="btn primary" id="import-confirm"></button>') + '<button class="btn ghost" id="import-cancel">Annuler</button></div><p class="sh-note">Aucune donnée n’a été modifiée pendant cet aperçu.</p></article>');
   $("import-cancel").onclick = closeSheet;
   const importMissing = () => {
      const choice = document.querySelector('input[name="import-missing"]:checked');
      return !choice || choice.value === "yes";
   };
   const selectedWordCount = () =>
      uniquePreviewWords.filter((word) => importMissing() || !word.incomplete).length;
   const recognizedWordCount = uniquePreviewWords.filter((word) => !word.incomplete).length;
   const structuredIncomingPacks = preview.packs.filter((pack) => !pack.unclassified);
   const incomingCategoryNames = Array.from(new Set(structuredIncomingPacks.flatMap((pack) =>
      pack.categories.map((category) => category.name),
   )));
   const lastIncomingPack = structuredIncomingPacks[structuredIncomingPacks.length - 1];
   const replacementCategoryNames = lastIncomingPack ? lastIncomingPack.categories.map((category) => category.name) : [];
   const quotedNames = (categoryNames) => categoryNames.length
      ? categoryNames.map((name) => "« " + name + " »").join(", ")
      : "aucune";
   const updateImportMode = () => {
      const mode = document.querySelector('input[name="import-mode"]:checked').value;
      const merge = mode === "merge";
      const wordCount = selectedWordCount();
      const wordLabel = wordCount + " mot" + (wordCount > 1 ? "s" : "");
      $("import-target-field").hidden = !merge;
      if ($("import-recognized-count"))
         $("import-recognized-count").textContent = recognizedWordCount === 1
            ? "Seul le mot reconnu sera importé."
            : "Seuls les " + recognizedWordCount + " mots reconnus seront importés.";
      const target = db.packs.find((pack) => pack.id === $("import-target").value);
      const currentCategoryNames = target ? categoriesForPack(target.id).map((category) => category.name) : [];
      const showStructureChoice = merge && currentCategoryNames.length > 0 && structuredIncomingPacks.length > 0;
      $("import-replace-field").hidden = !showStructureChoice;
      if (showStructureChoice) {
         $("import-structure-question").textContent = "Comment ranger ces mots dans « " + target.name + " » ?";
         $("import-structure-keep-help").textContent = "Tes sous-catégories actuelles sont gardées : " + quotedNames(currentCategoryNames) + ". Celles du fichier — " + quotedNames(incomingCategoryNames) + " — sont ajoutées si elles n’existent pas encore.";
         $("import-structure-replace-help").textContent = "Les sous-catégories actuelles de « " + target.name + " » — " + quotedNames(currentCategoryNames) + " — sont supprimées et remplacées par celles du fichier" + (structuredIncomingPacks.length > 1 ? ", selon le dernier pack « " + lastIncomingPack.name + " »" : "") + " : " + quotedNames(replacementCategoryNames) + ". Aucune carte n’est supprimée et ta progression reste intacte, mais les mots qui étaient rangés dans une sous-catégorie absente du fichier ne seront plus rangés dans ce pack.";
      }
      const replaceStructure = showStructureChoice && document.querySelector('input[name="import-structure"]:checked').value === "replace";
      $("import-confirm").classList.toggle("primary", !replaceStructure);
      $("import-confirm").classList.toggle("danger", replaceStructure);
      $("import-confirm").textContent = merge
         ? target
            ? replaceStructure
               ? "Remplacer l’organisation et ajouter " + wordLabel
               : "Ajouter " + wordLabel + " à « " + target.name + " »"
            : "Choisir le pack à compléter (" + wordLabel + ")"
         : preview.packs.length === 1
            ? "Créer le pack « " + names + " » (" + wordLabel + ")"
            : "Créer " + preview.packs.length + " packs (" + wordLabel + ")";
   };
   document.querySelectorAll('input[name="import-mode"]').forEach((input) => input.onchange = updateImportMode);
   document.querySelectorAll('input[name="import-missing"]').forEach((input) => input.onchange = updateImportMode);
   document.querySelectorAll('input[name="import-structure"]').forEach((input) => input.onchange = updateImportMode);
   if ($("import-target")) $("import-target").onchange = () => {
      document.querySelector('input[name="import-structure"][value="keep"]').checked = true;
      updateImportMode();
   };
   if ($("import-confirm")) updateImportMode();
   if ($("import-confirm")) $("import-confirm").onclick = () => {
      const mode = document.querySelector('input[name="import-mode"]:checked').value;
      if (mode === "merge" && !$("import-target").value) { toast("Choisis le pack à fusionner."); return; }
      const replaceStructure = mode === "merge" && !$("import-replace-field").hidden && document.querySelector('input[name="import-structure"]:checked').value === "replace";
      const result = applyPackImport(preview, { mode, targetPackId: $("import-target").value, skipDuplicates: true, replaceStructure, importMissing: importMissing() });
      closeSheet(); lib.level = "packs"; renderLib(); toast(result.added + " nouvelle(s) carte(s), " + result.reused + " carte(s) réutilisée(s).");
   };
}

function openPackExampleSheet() {
   openSheet('<h3 class="sh-t">Exemple JSON</h3><p class="sh-p">Cet exemple est court, valide et directement copiable.</p><pre class="fmt" id="pack-json-example">' + esc(PACK_JSON_EXAMPLE) + '</pre><div class="sh-btns"><button class="btn primary" id="example-copy">Copier l’exemple</button><button class="btn ghost" id="example-back">Retour</button></div>');
   $("example-copy").onclick = async () => { try { await navigator.clipboard.writeText(PACK_JSON_EXAMPLE); toast("Exemple copié."); } catch (_) { toast("Sélectionne le texte pour le copier."); } };
   $("example-back").onclick = openPackImportSheet;
}

function openLibraryExportSheet() {
   openSheet('<h3 class="sh-t">Exporter la bibliothèque</h3><p class="sh-p">L’export conserve la structure, les propriétés des mots et toute la progression SRS.</p><div class="export-pack-list">' + db.packs.map((pack) => '<label class="ck"><input type="checkbox" data-export-pack="' + esc(pack.id) + '"> ' + esc(pack.name) + "</label>").join("") + '</div><div class="sh-btns"><button class="btn primary" id="export-selected">Exporter les packs cochés</button><button class="btn" id="export-all-library">Exporter toute la bibliothèque</button><button class="btn ghost" data-sheet-close>Annuler</button></div>');
   $("export-selected").onclick = () => { const ids = Array.from(document.querySelectorAll("[data-export-pack]:checked")).map((input) => input.dataset.exportPack); if (!ids.length) { toast("Coche au moins un pack."); return; } downloadJson(buildLibraryExport(ids), "mo-studio-packs.json"); };
   $("export-all-library").onclick = () => downloadJson(buildLibraryExport(), "mo-studio-bibliotheque-complete.json");
}
