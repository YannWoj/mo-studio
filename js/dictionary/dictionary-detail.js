"use strict";

let dictionaryDetailToken = 0;
let dictionaryCharacterCardToken = 0;

function cardActionsHtml(card) {
   return (
      '<section class="dd-card-actions" aria-label="Mot personnel"><div class="acts">' +
      '<button class="act' + (card.fav ? " on" : "") + '" id="dd-fav">Favori</button>' +
      '<button class="act' + (card.acquired ? " on jade" : "") + '" id="dd-acq">Maîtrisé</button>' +
      "</div>" +
      '<button class="btn ghost wide" id="dd-manage">Modifier ou gérer ce mot</button></section>'
   );
}

function normalizeDetailEntry(value) {
   if (value && value.simplified) return value;
   if (value && value.src === "card" && value.cardId) {
      const card = db.cards.find((item) => item.id === value.cardId);
      if (card) return personalCardAsDictionaryEntry(card);
   }
   const hanzi = value && value.hz ? value.hz : "";
   const marked = value && value.py ? normalizePinyinMarked(value.py) : "";
   return {
      id: "legacy-" + hanzi + "-" + normalizePinyinNumbered(marked),
      simplified: hanzi,
      traditional: hanzi,
      entryType: Array.from(hanzi).length === 1 ? "character" : "word",
      pinyin: marked
         ? [{ marked, numbered: normalizePinyinNumbered(marked), plain: normalizePinyinPlain(marked) }]
         : [],
      definitionsFr: value && value.fr ? [value.fr] : [],
      definitionsEn: [],
      sources: [],
      sourceRefs: [],
      hskLegacy: [],
      hsk30: [],
      frequencyRank: null,
      characters: Array.from(hanzi).filter((character) => HAN_PATTERN.test(character)),
      cardId: value ? value.cardId : null,
      personalCard: value && value.cardId ? db.cards.find((card) => card.id === value.cardId) : null,
   };
}

function detailPinyin(entry, field) {
   return (entry.pinyin || []).map((variant) => variant[field]).filter(Boolean);
}

function uniqueDetailValues(values) {
   return Array.from(new Set(values));
}

async function dictionaryCharacterStudyEntry(character) {
   const personal = db.cards.find((card) => card.hz === character);
   if (personal) return attachHskMetadata(personalCardAsDictionaryEntry(personal));
   const found = await findDictionaryEntryByHanzi(character);
   return attachHskMetadata(found || normalizeDetailEntry({ hz: character }));
}

function dictionaryCharacterStudyCardShell(character) {
   return (
      '<section class="dd-character-study-card" id="dd-character-study-card" aria-busy="true">' +
      '<button class="seal dd-character-audio" type="button" data-say="' + esc(character) +
      '" aria-label="Écouter ' + esc(character) + '">听</button>' +
      '<div class="dd-character-study-main"><div class="dd-character-study-hanzi">' +
      esc(character) + '</div><div class="muted">Chargement du caractère…</div></div></section>'
   );
}

function dictionaryCharacterStudyCardHtml(entry, character) {
   const card = findPersonalCardForEntry(entry);
   const pinyin = dictionaryEntryPinyinText(entry);
   const definition = dictionaryResultDefinition(entry);
   return (
      '<button class="seal dd-character-audio" type="button" data-say="' + esc(character) +
      '" aria-label="Écouter ' + esc(character) + '">听</button>' +
      '<div class="dd-character-study-main"><div class="dd-character-study-hanzi" data-say="' +
      esc(character) + '">' + esc(character) + "</div>" +
      (pinyin ? '<div class="dd-character-study-pinyin">' + colorPinyin(pinyin) + "</div>" : "") +
      '<div class="dd-character-study-translation">' +
      (definition.english ? '<small class="search-fallback">EN · repli</small>' : "") +
      esc(definition.text) + "</div>" + verifiedHskBadges(entry) + "</div>" +
      '<div class="dd-character-study-action">' +
      (card
         ? '<span class="cd-cat jade">Dans Mes mots</span><button class="btn ghost" id="dd-character-manage" type="button">Ouvrir le mot</button>'
         : '<button class="btn ghost" id="dd-character-addcard" type="button" data-entry-id="' +
           esc(entry.id) + '">+ Ajouter à Mes mots</button>') +
      "</div>"
   );
}

async function renderDictionaryCharacterStudyCard(character, detailToken) {
   const target = $("dd-character-study-card");
   if (!target) return;
   const cardToken = ++dictionaryCharacterCardToken;
   target.setAttribute("aria-busy", "true");
   try {
      const entry = await dictionaryCharacterStudyEntry(character);
      if (
         cardToken !== dictionaryCharacterCardToken || detailToken !== dictionaryDetailToken ||
         ddChar !== character || !$("dd-character-study-card")
      ) return;
      target.innerHTML = dictionaryCharacterStudyCardHtml(entry, character);
      target.setAttribute("aria-busy", "false");
      if ($("dd-character-addcard"))
         $("dd-character-addcard").onclick = () => openDictionaryAddToWords(entry);
      if ($("dd-character-manage")) {
         const card = findPersonalCardForEntry(entry);
         $("dd-character-manage").onclick = () => card && openCardDetail(card.id);
      }
   } catch (error) {
      if (cardToken !== dictionaryCharacterCardToken || detailToken !== dictionaryDetailToken) return;
      target.setAttribute("aria-busy", "false");
      target.innerHTML =
         '<div class="dd-character-study-main"><div class="dd-character-study-hanzi">' +
         esc(character) + '</div><div class="muted">Données du caractère indisponibles.</div></div>';
   }
}

function dictionaryCharacterInteractionHtml(characters) {
   if (!characters.length) return "";
   return (
      '<section class="dd-character-interaction character-swipe-zone" id="dd-character-interaction" aria-label="Caractère étudié">' +
      (characters.length > 1
         ? '<div class="eyebrow">Caractères du mot</div><div class="picker" id="dd-picker">' +
           characters.map((character, index) =>
              '<button class="chip hzchip" type="button" data-i="' + index +
              '" data-character="' + esc(character) + '" aria-label="Afficher ' + esc(character) +
              ', position ' + (index + 1) + " sur " + characters.length + '" aria-pressed="' +
              String(index === 0) + '" aria-current="' + String(index === 0) + '">' +
              esc(character) + "</button>",
           ).join("") + "</div>" + dictionaryCharacterStudyCardShell(characters[0])
         : "") +
      characterNavigationHtml("dd-character", characters[0], 0, characters.length) +
      '<div class="eyebrow">Ordre des traits</div>' + strokeBoxHtml() +
      '<div class="dd-related" id="dd-related"><span class="muted">Chargement des mots liés…</span></div>' +
      "</section>"
   );
}

function verifiedHskBadges(entry) {
   const output = [];
   verifiedHskLevels(entry).forEach((level) =>
      output.push(
         '<span class="cd-cat hsk-badge hsk-level-' +
            level +
            '" data-hsk-badge="' +
            level +
            '">HSK ' +
            esc(level) +
            "</span>",
      ),
   );
   if (Array.isArray(entry.hskLegacy))
      entry.hskLegacy.forEach((level) => output.push('<span class="cd-cat">HSK historique ' + esc(level) + "</span>"));
   if (Array.isArray(entry.hsk30))
      entry.hsk30.forEach((level) => output.push('<span class="cd-cat">HSK 3.0 ' + esc(level) + "</span>"));
   return output.join("");
}

function dictionaryHskSourceHtml(entry) {
   const values = Array.isArray(entry.hskVerified) ? entry.hskVerified : [];
   if (!values.length) return "";
   return (
      '<section class="dd-hsk-source"><div class="eyebrow">Données HSK source</div>' +
      values
         .map(
            (item) =>
               '<div class="dd-hsk-source-item"><div><b>HSK ' +
               esc(item.firstHskLevel ?? item.level) +
               "</b> · " +
               colorPinyin(item.sourcePinyin || "") +
               "</div>" +
               (item.sourceTranslation
                  ? '<p class="dd-hsk-translation">' + esc(item.sourceTranslation) + "</p>"
                  : "") +
               '<small>' +
               (item.partOfSpeech ? esc(item.partOfSpeech) + " · " : "") +
               esc(hskLinkStatusLabel(item.dictionaryLinkStatus)) +
               (Array.isArray(item.sourceLevels) && item.sourceLevels.length > 1
                  ? " · niveaux source " + item.sourceLevels.map(esc).join(", ")
                  : "") +
               "</small></div>",
         )
         .join("") +
      "</section>"
   );
}

function dictionaryDefinitionsHtml(entry) {
   if (entry.definitionsFr && entry.definitionsFr.length) {
      return (
         '<section class="dd-definitions"><div class="eyebrow">Définitions françaises</div><ul>' +
         entry.definitionsFr.map((definition) => "<li>" + esc(definition) + "</li>").join("") +
         "</ul></section>"
      );
   }
   if (entry.definitionsEn && entry.definitionsEn.length) {
      return (
         '<section class="dd-definitions english"><div class="eyebrow">Anglais · repli, français indisponible</div><ul>' +
         entry.definitionsEn.map((definition) => "<li>" + esc(definition) + "</li>").join("") +
         "</ul></section>"
      );
   }
   return '<p class="muted">Aucune définition fournie par les sources disponibles.</p>';
}

function dictionarySourcesHtml(entry) {
   if (!entry.sources || !entry.sources.length) return "";
   return (
      '<details class="dd-sources"><summary>Sources du dictionnaire</summary><span>' +
      entry.sources.map(esc).join(" · ") +
      "</span></details>"
   );
}

function findPersonalCardForEntry(entry) {
   if (entry.personalCard) return db.cards.find((card) => card.id === entry.personalCard.id) || null;
   if (entry.cardId) return db.cards.find((card) => card.id === entry.cardId) || null;
   const identity = dictionaryEntryIdentity(entry);
   return (
      db.cards.find((card) => dictionaryEntryIdentity(personalCardAsDictionaryEntry(card)) === identity) ||
      null
   );
}

function addDictionaryEntryToPersonalCards(entry) {
   const french = (entry.definitionsFr || []).join(" ; ");
   const draft = {
      hz: entry.simplified,
      py: detailPinyin(entry, "marked").join(" / "),
      fr: french,
      cat: "",
   };
   if (!french) {
      toast("Ajoute une définition française vérifiée avant d’enregistrer.");
      openCardForm(draft);
      return null;
   }
   const normalized = normalizeCard(draft, false);
   if (!normalized) return null;
   const identity = dictionaryEntryIdentity(entry);
   if (db.cards.some((item) => dictionaryEntryIdentity(personalCardAsDictionaryEntry(item)) === identity)) {
      return db.cards.find(
         (item) => dictionaryEntryIdentity(personalCardAsDictionaryEntry(item)) === identity,
      );
   }
   db.cards.push(normalized);
   invalidateDictIndex();
   save();
   toast("« " + entry.simplified + " » ajouté à Mes mots.");
   return normalized;
}

function returnFromDictionaryAdd(entry, options) {
   if (options && typeof options.onCardStateChange === "function")
      options.onCardStateChange();
   else openDictDetail(entry, options);
}

function openDictionaryAddToWords(entry, options, state) {
   const existing = findPersonalCardForEntry(entry);
   const selected = new Set(
      state && Array.isArray(state.packIds)
         ? state.packIds
         : existing
           ? db.packs.filter((pack) => pack.cardIds.includes(existing.id)).map((pack) => pack.id)
           : [],
   );
   const french =
      state && typeof state.french === "string"
         ? state.french
         : (entry.definitionsFr || []).join(" ; ");
   const packChoices = db.packs.length
      ? '<div class="dd-add-packs"><div class="eyebrow">Packs facultatifs</div>' +
        db.packs
           .map(
              (pack) =>
                 '<label class="ck"><input type="checkbox" data-dd-add-pack="' +
                 esc(pack.id) +
                 '"' +
                 (selected.has(pack.id) ? " checked" : "") +
                 "> " +
                 esc(pack.name) +
                 "</label>",
           )
           .join("") +
        "</div>"
      : '<p class="sh-note">Aucun pack pour l’instant. Tu peux en créer un ci-dessous.</p>';
   openSheet(
      '<section class="dd-add-words" aria-labelledby="dd-add-title"><h3 class="sh-t" id="dd-add-title">' +
         (existing ? "Gérer dans Mes mots" : "Ajouter à Mes mots") +
         '</h3><div class="dd-add-word"><b>' +
         esc(entry.simplified) +
         "</b><span>" +
         colorPinyin(dictionaryEntryPinyinText(entry)) +
         "</span></div>" +
         (existing
            ? '<p class="sh-note">Ce mot existe déjà : sa carte unique sera conservée.</p>'
            : '<label class="f-lab">Définition française *<input class="search" id="dd-add-fr" value="' +
              esc(french) +
              '"></label>') +
         packChoices +
         '<div class="pk-new"><input class="search" id="dd-add-pack-name" placeholder="Nouveau pack"><button class="btn" id="dd-add-pack-create" type="button">Créer</button></div>' +
         '<p class="sh-note">Sans pack sélectionné, le mot est ajouté directement à Mes mots.</p>' +
         '<div class="sh-btns"><button class="btn primary" id="dd-add-confirm" type="button">' +
         (existing ? "Enregistrer" : "+ Ajouter à Mes mots") +
         '</button><button class="btn ghost" id="dd-add-cancel" type="button">Annuler</button></div></section>',
   );
   const currentSelection = () =>
      Array.from(document.querySelectorAll("[data-dd-add-pack]:checked")).map(
         (checkbox) => checkbox.dataset.ddAddPack,
      );
   $("dd-add-pack-create").onclick = () => {
      const name = $("dd-add-pack-name").value.trim();
      if (!name) return toast("Donne un nom au pack.");
      if (db.packs.some((pack) => pack.name.toLowerCase() === name.toLowerCase()))
         return toast("Ce pack existe déjà.");
      const pack = { id: uid(), name, cardIds: [] };
      db.packs.push(pack);
      save();
      openDictionaryAddToWords(entry, options, {
         french: existing ? french : $("dd-add-fr").value,
         packIds: currentSelection().concat(pack.id),
      });
      toast("Pack créé et sélectionné.");
   };
   $("dd-add-cancel").onclick = () => returnFromDictionaryAdd(entry, options);
   $("dd-add-confirm").onclick = () => {
      let card = findPersonalCardForEntry(entry);
      const wasExisting = !!card;
      if (!card) {
         const definition = $("dd-add-fr").value.trim();
         if (!definition) return toast("La définition française est obligatoire.");
         card = normalizeCard(
            {
               hz: entry.simplified,
               py: detailPinyin(entry, "marked").join(" / "),
               fr: definition,
               cat: "",
            },
            false,
         );
         if (!card) return;
         db.cards.push(card);
         invalidateDictIndex();
      }
      const memberships = new Set(currentSelection());
      db.packs.forEach((pack) => {
         const ids = new Set(pack.cardIds);
         if (memberships.has(pack.id)) ids.add(card.id);
         else if (wasExisting) ids.delete(card.id);
         pack.cardIds = Array.from(ids);
      });
      entry.personalCard = card;
      save();
      toast(
         wasExisting
            ? "Packs de « " + entry.simplified + " » mis à jour."
            : "« " + entry.simplified + " » ajouté à Mes mots.",
      );
      returnFromDictionaryAdd(entry, options);
   };
}

function openDictDetail(rawEntry, options) {
   const entry = attachHskMetadata(normalizeDetailEntry(rawEntry));
   const settings = options || {};
   const currentDetail = document.querySelector("#sheet.open .dd-entry");
   if (!currentDetail || currentDetail.dataset.entryId !== String(entry.id))
      resetStrokeAutoplaySelection();
   const card = findPersonalCardForEntry(entry);
   const characters = Array.from(entry.simplified).filter((character) => HAN_PATTERN.test(character));
   const marked = uniqueDetailValues(detailPinyin(entry, "marked"));
   const numbered = uniqueDetailValues(detailPinyin(entry, "numbered"));
   const traditional = entry.traditional && entry.traditional !== entry.simplified ? entry.traditional : "";
   const token = ++dictionaryDetailToken;

   openSheet(
      '<article class="dd-entry" data-entry-id="' + esc(entry.id) + '">' +
         '<div class="cd-head"><div><div class="cd-hz" data-say="' + esc(entry.simplified) + '">' +
         esc(entry.simplified) +
         '</div>' +
         (traditional ? '<div class="dd-traditional">Traditionnel · ' + esc(traditional) + "</div>" : "") +
         '</div><div class="dd-top-actions"><button class="seal" data-say="' + esc(entry.simplified) + '" aria-label="Écouter">听</button>' +
         '<button class="dd-top-close" id="dd-close-top" data-sheet-close aria-label="Fermer la fiche">×</button></div></div>' +
         (marked.length ? '<div class="cd-py">' + marked.map(colorPinyin).join(" · ") + "</div>" : "") +
         (numbered.length ? '<div class="dd-numbered">' + numbered.map(esc).join(" · ") + "</div>" : "") +
         dictionaryDefinitionsHtml(entry) +
         dictionaryHskSourceHtml(entry) +
         '<section class="dd-learning-actions"><button class="btn wide" id="dd-write" type="button">写 Écrire ce mot</button></section>' +
         (card
            ? cardActionsHtml(card)
            : '<section class="dd-card-actions" aria-label="Mot personnel"><button class="btn primary wide" id="dd-addcard">+ Ajouter à Mes mots</button></section>') +
         '<div class="dd-meta"><span class="cd-cat">' +
         (entry.entryType === "character" ? "Caractère" : "Mot") +
         "</span>" +
         verifiedHskBadges(entry) +
         (Number.isFinite(entry.frequencyRank)
            ? '<span class="cd-cat">Fréquence vérifiée · ' + esc(entry.frequencyRank) + "</span>"
            : "") +
         (card ? '<span class="cd-cat jade">Dans Mes mots</span>' : "") +
         "</div>" +
         (card && card.exHz ? exampleHtml(card) : "") +
         (card && card.note ? noteHtml(card) : "") +
         dictionaryCharacterInteractionHtml(characters) +
         dictionarySourcesHtml(entry) +
         '<div class="sh-btns"><button class="btn ghost wide" id="dd-close">' +
         (settings.fromSearch ? "← Retour aux résultats" : "Fermer") +
         "</button></div></article>",
   );
   wireDictDetail(entry, characters, card, token, settings);
}

async function renderDictionaryRelatedWords(character, token) {
   const target = $("dd-related");
   if (!target) return;
   target.setAttribute("aria-busy", "true");
   target.innerHTML = '<span class="muted">Chargement des mots liés à ' + esc(character) + "…</span>";
   try {
      const related = await loadDictionaryCharacterLinks(character, 10);
      if (token !== dictionaryDetailToken || ddChar !== character || !$("dd-related")) return;
      target.setAttribute("aria-busy", "false");
      if (!related.words.length) {
         target.innerHTML = '<span class="muted">Aucun mot lié classé par les sources.</span>';
         return;
      }
      target.innerHTML =
         '<div class="eyebrow">Mots liés vérifiés</div><div class="dd-related-list">' +
         related.words
            .map(
               (word, index) =>
                  '<button class="chip hzchip" data-related="' + index + '">' + esc(word.simplified) + "</button>",
            )
            .join("") +
         "</div>";
      target.querySelectorAll("[data-related]").forEach((button) => {
         button.onclick = () => {
            const word = related.words[Number(button.dataset.related)];
            if (typeof openSearchDictionaryDetail === "function" && activeView === "search")
               openSearchDictionaryDetail(word, true);
            else openDictDetail(word);
         };
      });
   } catch (error) {
      if (token === dictionaryDetailToken && ddChar === character && $("dd-related")) {
         target.setAttribute("aria-busy", "false");
         target.innerHTML = '<span class="muted">Mots liés indisponibles.</span>';
      }
   }
}

function wireDictDetail(entry, characters, card, token, options) {
   if (characters.length) wireStrokeWorkspace();
   let selectedCharacterIndex = 0;
   const selectCharacter = (index) => {
      const nextIndex = Math.max(0, Math.min(Number(index) || 0, characters.length - 1));
      const character = characters[nextIndex];
      selectedCharacterIndex = nextIndex;
      updateCharacterNavigation(
         "dd-character",
         characters,
         nextIndex,
         "#dd-picker .hzchip",
      );
      const selectionKey =
         options && typeof options.strokeSelectionKey === "function"
            ? options.strokeSelectionKey(character, nextIndex)
            : characters.length > 1
              ? `${entry.id}:${nextIndex}:${character}`
              : character;
      loadDDChar(character, characters, {
         selectionKey,
         selectionIndex: nextIndex,
         stripSelectionIndex:
            options && Number.isInteger(options.sequenceIndex)
               ? options.sequenceIndex
               : nextIndex,
      });
      renderDictionaryRelatedWords(character, token);
      if (characters.length > 1) renderDictionaryCharacterStudyCard(character, token);
   };
   const moveCharacter = (delta) => {
      const nextIndex = selectedCharacterIndex + delta;
      if (nextIndex < 0 || nextIndex >= characters.length) return;
      selectCharacter(nextIndex);
   };
   if (characters.length) {
      selectCharacter(0);
      document.querySelectorAll("#dd-picker .hzchip").forEach((button) => {
         button.onclick = () => selectCharacter(Number(button.dataset.i));
      });
      if ($("dd-character-prev")) $("dd-character-prev").onclick = () => moveCharacter(-1);
      if ($("dd-character-next")) $("dd-character-next").onclick = () => moveCharacter(1);
      setupSwipe(
         $("dd-character-interaction"),
         () => moveCharacter(1),
         () => moveCharacter(-1),
      );
   }
   if (card) {
      if ($("dd-fav"))
         $("dd-fav").onclick = () => {
            card.fav = !card.fav;
            save();
            if (options && typeof options.onCardStateChange === "function")
               options.onCardStateChange();
            else openDictDetail(entry, options);
         };
      if ($("dd-acq"))
         $("dd-acq").onclick = () => {
            card.acquired = !card.acquired;
            if (card.acquired) card.due = null;
            save();
            if (options && typeof options.onCardStateChange === "function") {
               options.onCardStateChange();
            } else {
               openDictDetail(entry, options);
               refreshActive();
            }
         };
      if ($("dd-manage")) $("dd-manage").onclick = () => openCardDetail(card.id);
   }
   if ($("dd-addcard"))
      $("dd-addcard").onclick = () => openDictionaryAddToWords(entry, options);
   if ($("dd-write"))
      $("dd-write").onclick = () => openWritingWord(entry.simplified);
   const closeDetail = () => {
         if (options && options.fromSearch && typeof closeSearchDictionaryDetail === "function")
            closeSearchDictionaryDetail();
         else closeSheet();
   };
   if ($("dd-close")) $("dd-close").onclick = closeDetail;
   if ($("dd-close-top")) $("dd-close-top").onclick = closeDetail;
   setTimeout(() => {
      const closeButton = $("dd-close-top");
      if (closeButton && sheetOpen()) closeButton.focus({ preventScroll: true });
   }, 0);
}
