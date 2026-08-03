"use strict";

let dictionaryDetailToken = 0;

function cardActionsHtml(card) {
   return (
      '<section class="dd-card-actions" aria-label="Carte personnelle"><div class="acts">' +
      '<button class="act' + (card.fav ? " on" : "") + '" id="dd-fav">♥ Favori</button>' +
      '<button class="act' + (card.acquired ? " on jade" : "") + '" id="dd-acq">✓ Acquise</button>' +
      "</div>" +
      '<button class="btn ghost wide" id="dd-manage">Modifier ou gérer cette carte</button></section>'
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

function verifiedHskBadges(entry) {
   const output = [];
   if (Array.isArray(entry.hskLegacy))
      entry.hskLegacy.forEach((level) => output.push('<span class="cd-cat">HSK historique ' + esc(level) + "</span>"));
   if (Array.isArray(entry.hsk30))
      entry.hsk30.forEach((level) => output.push('<span class="cd-cat">HSK 3.0 ' + esc(level) + "</span>"));
   return output.join("");
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

function openDictDetail(rawEntry, options) {
   const entry = normalizeDetailEntry(rawEntry);
   const settings = options || {};
   const card = findPersonalCardForEntry(entry);
   const characters = uniqueDetailValues(
      Array.from(entry.simplified).filter((character) => HAN_PATTERN.test(character)),
   );
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
         (card
            ? cardActionsHtml(card)
            : '<section class="dd-card-actions" aria-label="Carte personnelle"><button class="btn primary wide" id="dd-addcard">+ Ajouter à mes cartes</button></section>') +
         '<div class="dd-meta"><span class="cd-cat">' +
         (entry.entryType === "character" ? "Caractère" : "Mot") +
         "</span>" +
         verifiedHskBadges(entry) +
         (Number.isFinite(entry.frequencyRank)
            ? '<span class="cd-cat">Fréquence vérifiée · ' + esc(entry.frequencyRank) + "</span>"
            : "") +
         (card ? '<span class="cd-cat jade">Dans tes cartes</span>' : "") +
         "</div>" +
         (card && card.exHz ? exampleHtml(card) : "") +
         (card && card.note ? noteHtml(card) : "") +
         (characters.length > 1
            ? '<div class="eyebrow">Caractères du mot</div><div class="picker" id="dd-picker">' +
              characters
                 .map(
                    (character, index) =>
                       '<button class="chip hzchip" data-i="' + index + '" aria-pressed="' +
                       String(index === 0) + '">' + esc(character) + "</button>",
                 )
                 .join("") +
              "</div>"
            : "") +
         (characters.length
            ? '<div class="eyebrow">Ordre des traits</div>' + strokeBoxHtml() +
              '<div class="dd-related" id="dd-related"><span class="muted">Chargement des mots liés…</span></div>'
            : "") +
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
   try {
      const related = await loadDictionaryCharacterLinks(character, 10);
      if (token !== dictionaryDetailToken || !$("dd-related")) return;
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
            if (typeof openSearchDictionaryDetail === "function" && activeView === "write")
               openSearchDictionaryDetail(word, true);
            else openDictDetail(word);
         };
      });
   } catch (error) {
      if (token === dictionaryDetailToken && $("dd-related"))
         target.innerHTML = '<span class="muted">Mots liés indisponibles.</span>';
   }
}

function wireDictDetail(entry, characters, card, token, options) {
   if (characters.length) wireStrokeWorkspace();
   const selectCharacter = (character) => {
      loadDDChar(character, characters);
      renderDictionaryRelatedWords(character, token);
   };
   if (characters.length) {
      selectCharacter(characters[0]);
      document.querySelectorAll("#dd-picker .hzchip").forEach((button) => {
         button.onclick = () => selectCharacter(characters[Number(button.dataset.i)]);
      });
   }
   if (card) {
      if ($("dd-fav"))
         $("dd-fav").onclick = () => {
            card.fav = !card.fav;
            save();
            openDictDetail(entry, options);
         };
      if ($("dd-acq"))
         $("dd-acq").onclick = () => {
            card.acquired = !card.acquired;
            if (card.acquired) card.due = null;
            save();
            openDictDetail(entry, options);
            refreshActive();
         };
      if ($("dd-manage")) $("dd-manage").onclick = () => openCardDetail(card.id);
   }
   if ($("dd-addcard"))
      $("dd-addcard").onclick = () => {
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
            return;
         }
         const normalized = normalizeCard(draft, false);
         if (!normalized) return;
         const identity = dictionaryEntryIdentity(entry);
         if (db.cards.some((item) => dictionaryEntryIdentity(personalCardAsDictionaryEntry(item)) === identity))
            return toast("Déjà dans tes cartes.");
         db.cards.push(normalized);
         invalidateDictIndex();
         save();
         entry.personalCard = normalized;
         toast("« " + entry.simplified + " » ajoutée à tes cartes.");
         openDictDetail(entry, options);
      };
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
