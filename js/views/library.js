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

function dueCount(cards) {
   return cards.filter(isDue).length;
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

function packTileHtml(pack) {
   const categories = categoriesForPack(pack.id);
   const cards = cardsForPack(pack.id);
   return '<article class="pack-tile"><button class="pack-open" data-pack-open="' + esc(pack.id) + '"><span class="pack-mark">册</span><span class="pack-copy"><strong>' + esc(pack.name) + '</strong><span>' + categories.length + ' sous-catégorie' + (categories.length > 1 ? "s" : "") + ' · ' + cards.length + ' mot' + (cards.length > 1 ? "s" : "") + '</span></span><span class="due-pill">' + dueCount(cards) + ' à revoir</span></button><div class="tile-actions"><button class="btn sm ghost" data-pack-review="' + esc(pack.id) + '">Réviser</button><button class="btn sm ghost" data-pack-export="' + esc(pack.id) + '">Exporter</button><button class="btn sm ghost" data-pack-rename="' + esc(pack.id) + '">Renommer</button><button class="btn sm danger" data-pack-delete="' + esc(pack.id) + '">Supprimer</button></div></article>';
}

function renderPackLibrary() {
   const root = $("view");
   root.innerHTML = '<section class="library-page">' + libraryHeaderHtml() +
      '<div class="library-toolbar"><button class="btn" id="lib-create-pack">Créer un pack</button><button class="btn ghost" id="lib-show-all">Voir tous les mots (' + db.cards.length + ')</button><button class="btn ghost" id="lib-export">Exporter</button></div>' +
      (db.packs.length ? '<div class="pack-grid">' + db.packs.map(packTileHtml).join("") + "</div>" : '<div class="lib-empty card"><div class="pack-mark large">册</div><h3>Aucun pack</h3><p>Crée un pack ou importe directement un JSON. Tes anciennes cartes restent accessibles dans « Tous les mots ».</p></div>') +
      "</section>";
   wireLibraryCommon();
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
   if (!cards.length) { toast("Aucune carte dans cette sélection."); return; }
   openReviewForManualCards(cards, label);
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
      (card.note ? '<div class="note">' + esc(card.note) + "</div>" : "") +
      '<div class="acts"><button class="act' + (card.fav ? " on" : "") +
      '" id="card-favorite">Favori</button><button class="act' +
      (card.difficult ? " on" : "") +
      '" id="card-difficult">Difficile</button><button class="act' +
      (card.acquired ? " on jade" : "") + '" id="card-mastered">Maîtrisé</button></div>' +
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
      '<div class="eyebrow">Présent dans</div>' + cardCategoryCheckboxes(card) +
      '<div class="sh-btns"><button class="btn primary" id="card-review-one">Réviser</button><button class="btn" id="card-edit">Modifier</button><button class="btn danger" id="card-delete">Supprimer</button><button class="btn ghost" id="card-close" data-sheet-close>Fermer</button></div></article>',
   );
   wireCardStrokeWorkspace(card, characters, context, initialCharacterIndex);
   $("card-favorite").onclick = () => { card.fav = !card.fav; card.updated = Date.now(); save(); openCardDetail(id, context); };
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

function openCardForm(card, initialCategoryIds) {
   const existingCard = card && db.cards.find((item) => item.id === card.id);
   const current = card || {};
   openSheet('<h3 class="sh-t">' + (existingCard ? "Modifier le mot" : "Ajouter un mot") + '</h3><label class="f-lab">Caractères chinois *<input class="search" id="word-hz" value="' + esc(current.hz || "") + '"></label><label class="f-lab">Pinyin<input class="search" id="word-py" value="' + esc(current.py || "") + '"></label><label class="f-lab">Traduction<input class="search" id="word-fr" value="' + esc(current.fr || "") + '"></label><label class="f-lab">Notes<textarea class="search" id="word-note" rows="2">' + esc(current.note || "") + '</textarea></label><label class="f-lab">Tags, séparés par des virgules<input class="search" id="word-tags" value="' + esc((current.tags || []).join(", ")) + '"></label><div class="eyebrow">Sous-catégories</div>' + cardCategoryCheckboxes(existingCard, initialCategoryIds) + '<div class="sh-btns"><button class="btn primary" id="word-save">Enregistrer</button><button class="btn ghost" data-sheet-close>Annuler</button></div>');
   $("word-save").onclick = async () => {
      const chinese = $("word-hz").value.trim();
      if (!chinese) { toast("Les caractères chinois sont obligatoires."); return; }
      let pinyin = $("word-py").value.trim(); let translation = $("word-fr").value.trim();
      if (!pinyin || !translation) { const match = await dictionaryCompletion(chinese); if (match) { pinyin ||= match.pinyin; translation ||= match.translation; } }
      const candidate = { hz: chinese, py: pinyin, fr: translation, senseId: current.senseId || "" };
      const duplicate = db.cards.find((item) => item.id !== (existingCard && existingCard.id) && personalCardKey(item) === personalCardKey(candidate));
      const saved = existingCard || duplicate || normalizeCard(candidate, false);
      saved.hz = chinese; saved.py = pinyin; saved.fr = translation; saved.note = $("word-note").value.trim(); saved.tags = $("word-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean); saved.incomplete = !pinyin || !translation; saved.updated = Date.now();
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

function openPackImportPreview(preview) {
   const names = preview.packs.map((pack) => pack.name).join(", ") || "—";
   const errors = preview.errors.length ? '<div class="import-error" role="alert"><strong>Erreurs de structure</strong><ul>' + preview.errors.map((error) => '<li>' + esc(error) + "</li>").join("") + "</ul></div>" : "";
   openSheet('<h3 class="sh-t">Aperçu avant import</h3><p class="sh-p"><strong>' + esc(names) + '</strong> · source ' + preview.sourceType.toUpperCase() + '</p><div class="import-stats"><div><b>' + preview.categoryCount + '</b><span>Sous-catégories</span></div><div><b>' + preview.wordCount + '</b><span>Mots</span></div><div><b>' + preview.duplicates + '</b><span>Doublons du fichier</span></div><div><b>' + preview.existing + '</b><span>Déjà présents</span></div><div><b>' + preview.missingDictionary + '</b><span>Absents du dictionnaire</span></div><div><b>' + preview.incomplete + '</b><span>Incomplets</span></div></div>' + errors + (preview.errors.length ? "" : '<fieldset class="import-options"><legend>Mode d’import</legend><label class="ck"><input type="radio" name="import-mode" value="new" checked> Créer un nouveau pack</label><label class="ck"><input type="radio" name="import-mode" value="merge"> Fusionner avec un pack existant</label><select class="search" id="import-target"><option value="">Choisir un pack existant</option>' + db.packs.map((pack) => '<option value="' + esc(pack.id) + '">' + esc(pack.name) + "</option>").join("") + '</select><label class="ck"><input type="checkbox" id="import-skip" checked> Ignorer les doublons internes</label><label class="ck"><input type="checkbox" id="import-replace-structure"> Remplacer uniquement la structure du pack, sans supprimer les cartes ni leur progression</label><label class="ck"><input type="checkbox" id="import-missing" checked> Importer les mots absents ou incomplets comme cartes personnelles</label></fieldset>') + '<div class="sh-btns">' + (preview.errors.length ? "" : '<button class="btn primary" id="import-confirm">Confirmer l’import</button>') + '<button class="btn ghost" id="import-cancel">Annuler</button></div><p class="sh-note">Aucune donnée n’a été modifiée pendant cet aperçu.</p>');
   $("import-cancel").onclick = closeSheet;
   if ($("import-confirm")) $("import-confirm").onclick = () => {
      const mode = document.querySelector('input[name="import-mode"]:checked').value;
      if (mode === "merge" && !$("import-target").value) { toast("Choisis le pack à fusionner."); return; }
      const result = applyPackImport(preview, { mode, targetPackId: $("import-target").value, skipDuplicates: $("import-skip").checked, replaceStructure: $("import-replace-structure").checked, importMissing: $("import-missing").checked });
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
