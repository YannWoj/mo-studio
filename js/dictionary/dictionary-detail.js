"use strict";

let dictionaryDetailToken = 0;
let dictionaryCharacterCardToken = 0;
let dictionaryPickerResizeObserver = null;

function cardActionsHtml(card) {
   return (
      '<section class="dd-card-actions" aria-label="Mot personnel"><div class="acts">' +
      '<button class="act' + (card.fav ? " on" : "") + '" id="dd-fav">Favori</button>' +
      '<button class="act' + (card.acquired ? " on jade" : "") + '" id="dd-acq">Maîtrisé</button>' +
      "</div>" +
      '<div class="dd-already-state"><b>Déjà dans Mes mots</b><span>La carte et sa progression SRS restent uniques.</span></div>' +
      '<button class="btn primary wide" id="dd-manage">Gérer les emplacements</button>' +
      '<button class="btn ghost wide" id="dd-edit-personal">Modifier la carte personnelle</button></section>'
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

function dictionaryDetailDisplayHanzi(entry) {
   if (entry.__selectedHanzi) return entry.__selectedHanzi;
   if (
      dictionaryVariantStatus(entry) !== "modern" &&
      entry.traditional && entry.traditional !== entry.simplified
   ) return entry.traditional;
   return entry.simplified;
}

async function dictionaryCharacterStudyEntry(character, completion) {
   const personal = db.cards.find((card) => card.hz === character);
   const found = personal
      ? personalCardAsDictionaryEntry(personal)
      : (completion && completion.entry
         ? completion.entry
         : (await findDictionaryEntryByHanzi(character)) || normalizeDetailEntry({ hz: character }));
   return attachHskMetadata(await dictionaryEntryWithFrenchSibling(found));
}

function updateDictionaryCharacterPicker(characters, completions) {
   const picker = $("dd-picker");
   if (!picker) return;
   picker.querySelectorAll(".dd-character-chip").forEach((button) => {
      const character = button.dataset.character || "";
      const completion = completions && typeof completions.get === "function" ? completions.get(character) : null;
      const pinyinNode = button.querySelector("[data-character-pinyin]");
      const definitionNode = button.querySelector("[data-character-definition]");
      const pinyin = completion && completion.pinyin ? completion.pinyin : "";
      const translation = completion && completion.translation ? completion.translation : "";
      const entrySenses = completion && completion.entry
         ? dictionarySplitSenses(completion.entry.definitionsFr)
         : [];
      const translationSenses = entrySenses.length
         ? entrySenses
         : dictionarySplitSenses(translation ? [translation] : []);
      const fullTranslation = translationSenses.join(" ; ");
      const compactTranslation = translationSenses.slice(0, 2).join(" ; ") +
         (translationSenses.length > 2 ? " …" : "");
      if (pinyinNode) {
         pinyinNode.dataset.characterPinyinValue = pinyin;
         pinyinNode.innerHTML = "";
         pinyinNode.hidden = !pinyin;
      }
      if (definitionNode) {
         definitionNode.dataset.characterDefinitionValue = compactTranslation;
         definitionNode.textContent = "";
         definitionNode.hidden = !compactTranslation;
         if (fullTranslation) button.title = fullTranslation;
         else button.removeAttribute("title");
      }
      const parts = [character, pinyin, fullTranslation].filter(Boolean);
      button.setAttribute(
         "aria-label",
         "Afficher " + parts.join(" · ") + ", position " + (Number(button.dataset.i) + 1) + " sur " + characters.length,
      );
   });
}

function updateDictionaryCharacterDetails(characters, completions) {
   const target = $("dd-character-details");
   if (!target || characters.length <= 1) return;
   target.setAttribute("aria-busy", "false");
   target.innerHTML =
      '<h3 class="eyebrow">Détail des caractères</h3><div class="dd-character-detail-list">' +
      characters.map((character) => {
         const completion = completions && typeof completions.get === "function"
            ? completions.get(character)
            : null;
         const pinyin = completion && completion.pinyin ? completion.pinyin : "";
         const translationSenses = completion && completion.entry
            ? dictionarySplitSenses(completion.entry.definitionsFr)
            : dictionarySplitSenses(completion && completion.translation ? [completion.translation] : []);
         const translation = translationSenses.join(" ; ");
         return (
            '<div class="dd-character-detail-row"><b class="dd-character-detail-hanzi">' +
            esc(character) + '</b><span class="dd-character-detail-pinyin">' +
            (pinyin ? colorPinyin(pinyin) : "—") +
            '</span><span class="dd-character-detail-translation">' +
            (translation ? esc(translation) : "Données indisponibles") +
            "</span></div>"
         );
      }).join("") + "</div>";
}

function dictionaryCharacterDetailsShellHtml(characters) {
   if (characters.length <= 1) return "";
   return (
      '<section class="dd-character-details" id="dd-character-details" aria-busy="true" aria-label="Détail des caractères">' +
      '<h3 class="eyebrow">Détail des caractères</h3><span class="muted">Chargement…</span></section>'
   );
}

function dictionaryCharacterPinyinHints(entry, characters) {
   const hints = new Map();
   const pronunciation = (entry.pinyin || [])
      .map((variant) => variant.marked || variant.numbered || "")
      .find((value) => value);
   if (!pronunciation) return hints;
   const parts = pronunciation.replace(/\s*\/\s*/g, " ").trim().split(/\s+/).filter(Boolean);
   if (parts.length !== characters.length) return hints;
   characters.forEach((character, index) => {
      if (!hints.has(character)) hints.set(character, parts[index]);
   });
   return hints;
}

async function loadDictionaryCharacterCompletions(characters, token, state, pinyinHints) {
   if (!state || !characters.length) return;
   try {
      const completions = typeof dictionaryCompletions === "function"
         ? await dictionaryCompletions(characters, pinyinHints, { includeEntry: true })
         : new Map();
      if (
         token !== dictionaryDetailToken ||
         document.querySelector('#sheet.open .dd-entry')?.dataset.entryId !== String(state.entryId)
      ) return;
      state.map = completions;
      state.ready = true;
      updateDictionaryCharacterPicker(characters, completions);
      updateDictionaryCharacterDetails(characters, completions);
      if (characters.length > 1)
         renderDictionaryCharacterStudyCard(characters[state.selectedIndex || 0], token, state);
   } catch (error) {
      if (token !== dictionaryDetailToken) return;
      state.map = new Map();
      state.ready = true;
      updateDictionaryCharacterPicker(characters, state.map);
      updateDictionaryCharacterDetails(characters, state.map);
      if (characters.length > 1)
         renderDictionaryCharacterStudyCard(characters[state.selectedIndex || 0], token, state);
   }
}

function dictionaryCharacterStudyCardShell(character) {
   return (
      '<section class="dd-character-study-card" id="dd-character-study-card" aria-busy="true">' +
      '<button class="seal dd-character-audio" type="button" data-say="' + esc(character) +
      '" aria-label="Écouter ' + esc(character) + '">听</button>' +
      '<button class="btn dd-character-write" id="dd-write" type="button">写 Écrire</button>' +
      '<div class="dd-character-study-actions"><span class="muted">Chargement…</span></div></section>'
   );
}

function dictionaryCharacterStudyCardHtml(entry, character) {
   const card = findPersonalCardForEntry(entry);
   return (
      '<button class="seal dd-character-audio" type="button" data-say="' + esc(character) +
      '" aria-label="Écouter ' + esc(character) + '">听</button>' +
      '<button class="btn dd-character-write" id="dd-write" type="button">写 Écrire</button>' +
      '<div class="dd-character-study-actions">' +
      (card
         ? '<button class="btn ghost" id="dd-character-manage" type="button">Ouvrir</button>'
         : '<button class="btn ghost" id="dd-character-addcard" type="button" aria-label="Ajouter ' +
           esc(character) + ' à Mes mots" data-entry-id="' + esc(entry.id) + '">+ Mes mots</button>') +
      "</div>"
   );
}

async function renderDictionaryCharacterStudyCard(character, detailToken, completionState) {
   const target = $("dd-character-study-card");
   if (!target) return;
   const cardToken = ++dictionaryCharacterCardToken;
   if (completionState && !completionState.ready) return;
   target.setAttribute("aria-busy", "true");
   try {
      const completion = completionState && completionState.map
         ? completionState.map.get(character)
         : null;
      const entry = await dictionaryCharacterStudyEntry(character, completion);
      if (
         cardToken !== dictionaryCharacterCardToken || detailToken !== dictionaryDetailToken ||
         ddChar !== character || !$("dd-character-study-card")
      ) return;
      target.innerHTML = dictionaryCharacterStudyCardHtml(entry, character);
      target.setAttribute("aria-busy", "false");
      wireDDWritingPracticeAction();
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
         '<button class="seal dd-character-audio" type="button" data-say="' + esc(character) +
         '" aria-label="Écouter ' + esc(character) + '">听</button>' +
         '<button class="btn dd-character-write" id="dd-write" type="button">写 Écrire</button>' +
         '<div class="dd-character-study-actions"><span class="muted">Données du caractère indisponibles.</span></div>';
      wireDDWritingPracticeAction();
   }
}

function dictionaryCharacterInteractionHtml(characters) {
   if (!characters.length) return "";
   const manyCharacters = characters.length >= 4;
   const pickerClass = manyCharacters ? "dd-character-picker dd-character-picker-many" : "dd-character-picker dd-character-picker-" + characters.length;
   return (
      '<section class="dd-character-interaction character-swipe-zone" id="dd-character-interaction" aria-label="Caractère étudié">' +
      (characters.length > 1
         ? '<div class="eyebrow">Caractères du mot</div><div class="dd-character-picker-rail' +
           (manyCharacters ? " dd-character-picker-rail-many" : "") + '"><div class="picker ' + pickerClass + '" id="dd-picker">' +
            characters.map((character, index) =>
              '<button class="chip hzchip dd-character-chip" type="button" data-i="' + index +
              '" data-character="' + esc(character) + '" aria-label="Afficher ' + esc(character) +
              ', position ' + (index + 1) + " sur " + characters.length + '" aria-pressed="' +
              String(index === 0) + '" aria-current="' + String(index === 0) + '">' +
              '<span class="dd-character-chip-hanzi">' + esc(character) + '</span>' +
              '<span class="dd-character-chip-pinyin" data-character-pinyin aria-hidden="true"></span>' +
              '<span class="dd-character-chip-definition" data-character-definition aria-hidden="true"></span>' +
              "</button>",
            ).join("") + "</div></div>"
         : "") +
      '<div class="eyebrow">Ordre des traits</div>' +
      strokeCharacterStageHtml("dd-character", characters[0], 0, characters.length, false, {
         showWritingAction: false,
      }) +
      dictionaryCharacterStudyCardShell(characters[0]) +
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
      '<section class="dd-hsk-source"><div class="eyebrow">Données HSK</div>' +
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
               (item.dictionaryLinkStatus === "duplicate-sense"
                  ? " · sens HSK distinct du sens général, pas une contradiction"
                  : "") +
               (Array.isArray(item.sourceLevels) && item.sourceLevels.length > 1
                  ? " · niveaux source " + item.sourceLevels.map(esc).join(", ")
                  : "") +
               "</small></div>",
         )
         .join("") +
      "</section>"
   );
}

function dictionarySplitSenses(values) {
   return Array.from(new Set(
      (values || []).flatMap((definition) => String(definition).split(/\s*;\s*/u))
         .map((sense) => sense.trim()).filter(Boolean),
   ));
}

function dictionaryFrenchDefinitionsHtml(entry) {
   const french = dictionarySplitSenses(entry.definitionsFr);
   if (!french.length)
      return '<section class="dd-definitions dd-french-unavailable" id="dd-french-definitions"><div class="eyebrow">Sens français</div><p>Traduction française indisponible</p></section>';
   const joined = french.join(" ; ");
   if (french.length <= 3)
      return '<section class="dd-definitions dd-french-compact dd-french-short" id="dd-french-definitions" aria-label="Sens français"><p class="dd-french-preview" title="' +
         esc(joined) + '">' + esc(joined) + "</p></section>";
   return '<section class="dd-definitions dd-french-compact dd-french-disclosure" id="dd-french-definitions" aria-label="Sens français">' +
      '<p class="dd-french-preview" title="' + esc(joined) + '">' + esc(joined) + "</p>" +
      '<div class="dd-french-expanded" id="dd-french-expanded" hidden><div class="eyebrow">Sens français</div><ol class="dd-sense-list">' +
      french.map((definition) => "<li>" + esc(definition) + "</li>").join("") + "</ol></div>" +
      '<button class="dd-french-toggle" type="button" data-french-disclosure aria-expanded="false" aria-controls="dd-french-expanded" data-sense-count="' +
      french.length + '">voir les ' + french.length + " sens</button></section>";
}

function wireDictionaryFrenchDefinitions() {
   const section = $("dd-french-definitions");
   const button = section && section.querySelector("[data-french-disclosure]");
   if (!button) return;
   const preview = section.querySelector(".dd-french-preview");
   const expandedContent = section.querySelector(".dd-french-expanded");
   button.onclick = () => {
      const expanded = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(expanded));
      if (preview) preview.hidden = expanded;
      if (expandedContent) expandedContent.hidden = !expanded;
      button.textContent = expanded
         ? "replier les " + button.dataset.senseCount + " sens"
         : "voir les " + button.dataset.senseCount + " sens";
   };
}

function wireDictionaryPickerOverflowCue() {
   if (dictionaryPickerResizeObserver) {
      dictionaryPickerResizeObserver.disconnect();
      dictionaryPickerResizeObserver = null;
   }
   const picker = $("dd-picker");
   const rail = picker && picker.closest(".dd-character-picker-rail");
   if (!picker || !rail) return;
   const update = () => {
      const overflowing = picker.scrollWidth > picker.clientWidth + 1;
      const atEnd = picker.scrollLeft + picker.clientWidth >= picker.scrollWidth - 1;
      rail.classList.toggle("is-overflowing", overflowing);
      rail.classList.toggle("is-at-end", !overflowing || atEnd);
   };
   picker.addEventListener("scroll", update, { passive: true });
   if (typeof ResizeObserver === "function") {
      dictionaryPickerResizeObserver = new ResizeObserver(update);
      dictionaryPickerResizeObserver.observe(picker);
   }
   requestAnimationFrame(update);
}

function dictionaryEnglishDefinitionsHtml(entry) {
   const english = dictionarySplitSenses(entry.definitionsEn).filter((definition) =>
      /\p{L}/u.test(definition),
   );
   return english.length
      ? '<details class="dd-definitions english"><summary>Sens anglais de référence</summary><ol class="dd-sense-list">' +
        english.map((definition) => "<li>" + esc(definition) + "</li>").join("") + "</ol></details>"
      : "";
}

function dictionaryVariantExplanationHtml(entry) {
   const status = dictionaryVariantStatus(entry);
   const traditional = entry.traditional && entry.traditional !== entry.simplified ? entry.traditional : "";
   if (!traditional && status === "modern") return "";
   const label = status === "ancient"
      ? "Forme ancienne signalée par la source"
      : status !== "modern" ? "Variante signalée par la source" : "Formes d’écriture";
   return '<section class="dd-variant-note"><div class="eyebrow">' + label + '</div><p>Simplifié · <b>' + esc(entry.simplified) + "</b>" + (traditional ? ' · Traditionnel · <b>' + esc(traditional) + "</b>" : "") + "</p></section>";
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
   const sourceEntryId = entry.dictionaryEntryId || (/^(?:word-|char-)/.test(entry.id || "") ? entry.id : "");
   if (sourceEntryId) {
      const sourced = db.cards.find((card) => card.dictionaryEntryId === sourceEntryId);
      if (sourced) return sourced;
   }
   const identity = dictionaryEntryIdentity(entry);
   return (
      db.cards.find(
         (card) =>
            !card.dictionaryEntryId &&
            dictionaryEntryIdentity(personalCardAsDictionaryEntry(card)) === identity,
      ) ||
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
      traditional: entry.traditional || "",
      dictionaryEntryId: entry.dictionaryEntryId || entry.id || "",
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

const DICTIONARY_PLACEMENT_KEY = "mo-studio-dictionary-placement-v1";

function readDictionaryPlacementMemory() {
   try {
      const memory = JSON.parse(localStorage.getItem(DICTIONARY_PLACEMENT_KEY) || "{}");
      return {
         lastPackId: typeof memory.lastPackId === "string" ? memory.lastPackId : "",
         categoryByPack: memory.categoryByPack && typeof memory.categoryByPack === "object" ? memory.categoryByPack : {},
         recentPackIds: Array.isArray(memory.recentPackIds) ? memory.recentPackIds.map(String).slice(0, 8) : [],
      };
   } catch (error) {
      return { lastPackId: "", categoryByPack: {}, recentPackIds: [] };
   }
}

function rememberDictionaryPlacement(packIds, categoryIds) {
   if (!packIds.length) return;
   const previous = readDictionaryPlacementMemory();
   const categoryByPack = { ...previous.categoryByPack };
   packIds.forEach((packId) => {
      const category = categoryIds
         .map(categoryById)
         .find((item) => item && item.packId === packId);
      if (category) categoryByPack[packId] = category.id;
   });
   const recentPackIds = uniqueStrings([...packIds.slice().reverse(), ...previous.recentPackIds]).slice(0, 8);
   try {
      localStorage.setItem(
         DICTIONARY_PLACEMENT_KEY,
         JSON.stringify({ lastPackId: packIds[packIds.length - 1], categoryByPack, recentPackIds }),
      );
   } catch (error) {
      /* La validation finale reste possible si la préférence locale est indisponible. */
   }
}

function dictionaryPlacementLocationsHtml(card) {
   if (!card) return "";
   const locations = categoriesForCard(card.id)
      .map((category) => {
         const pack = db.packs.find((item) => item.id === category.packId);
         return pack ? '<li>' + esc(pack.name) + ' <span aria-hidden="true">→</span> ' + esc(category.name) + "</li>" : "";
      })
      .filter(Boolean);
   return (
      '<section class="dd-current-locations"><div class="eyebrow">Emplacements actuels</div>' +
      (locations.length ? "<ul>" + locations.join("") + "</ul>" : '<p class="sh-note">Aucune sous-catégorie pour le moment.</p>') +
      "</section>"
   );
}

function initialDictionaryPlacementState(entry, existing) {
   const memory = readDictionaryPlacementMemory();
   const currentCategories = existing ? categoriesForCard(existing.id) : [];
   const selectedCategoryIds = new Set(currentCategories.map((category) => category.id));
   const selectedPackIds = new Set(currentCategories.map((category) => category.packId));
   if (!existing && db.packs.some((pack) => pack.id === memory.lastPackId)) {
      selectedPackIds.add(memory.lastPackId);
      const rememberedCategory = categoryById(memory.categoryByPack[memory.lastPackId]);
      if (rememberedCategory && rememberedCategory.packId === memory.lastPackId)
         selectedCategoryIds.add(rememberedCategory.id);
   }
   return {
      french: (entry.definitionsFr || []).join(" ; "),
      selectedPackIds,
      selectedCategoryIds,
      withoutCategoryPackIds: new Set(),
      openPackIds: new Set(selectedPackIds),
      filter: "",
      error: "",
   };
}

function dictionaryPlacementPackOrder(state) {
   const memory = readDictionaryPlacementMemory();
   const recentIndex = new Map(memory.recentPackIds.map((id, index) => [id, index]));
   return db.packs.slice().sort((left, right) => {
      const leftUsed = state.selectedPackIds.has(left.id) ? -2 : recentIndex.has(left.id) ? recentIndex.get(left.id) : 99;
      const rightUsed = state.selectedPackIds.has(right.id) ? -2 : recentIndex.has(right.id) ? recentIndex.get(right.id) : 99;
      return leftUsed - rightUsed || left.name.localeCompare(right.name, "fr");
   });
}

function dictionaryPlacementPackHtml(pack, state) {
   const selected = state.selectedPackIds.has(pack.id);
   const categories = categoriesForPack(pack.id);
   const selectedInPack = categories.filter((category) => state.selectedCategoryIds.has(category.id));
   const needsDecision = selected && !selectedInPack.length && !state.withoutCategoryPackIds.has(pack.id);
   return (
      '<details class="dd-pack-block" data-dd-pack-block="' + esc(pack.id) + '"' + (state.openPackIds.has(pack.id) ? " open" : "") + ">" +
      '<summary><label class="dd-pack-choice"><input type="checkbox" data-dd-add-pack="' + esc(pack.id) + '"' + (selected ? " checked" : "") + '><span><b>' + esc(pack.name) + '</b><small>' + categories.length + " sous-catégorie" + (categories.length > 1 ? "s" : "") + '</small></span></label><span class="dd-pack-chevron" aria-hidden="true">⌄</span></summary>' +
      '<div class="dd-pack-content"><div class="dd-category-list">' +
      (categories.length
         ? categories.map((category) => '<label class="dd-category-choice"><input type="checkbox" data-dd-add-category="' + esc(category.id) + '"' + (state.selectedCategoryIds.has(category.id) ? " checked" : "") + '><span>' + esc(category.name) + "</span></label>").join("")
         : '<p class="sh-note">Ce pack n’a encore aucune sous-catégorie.</p>') +
      "</div>" +
      (needsDecision
         ? '<div class="dd-placement-warning" role="note"><b>Où ranger ce mot ?</b><span>Choisis une sous-catégorie, ou confirme explicitement un classement général.</span><label class="dd-category-choice"><input type="checkbox" data-dd-without-category="' + esc(pack.id) + '"><span>Ajouter sans sous-catégorie <small>dans « Tous les mots »</small></span></label></div>'
         : state.withoutCategoryPackIds.has(pack.id)
           ? '<label class="dd-category-choice dd-without-choice"><input type="checkbox" data-dd-without-category="' + esc(pack.id) + '" checked><span>Ajouter sans sous-catégorie <small>dans « Tous les mots »</small></span></label>'
           : "") +
      '<div class="dd-category-create"><input class="search" data-dd-category-name="' + esc(pack.id) + '" aria-label="Nom de la nouvelle sous-catégorie dans ' + esc(pack.name) + '" placeholder="Nouvelle sous-catégorie"><button class="btn" type="button" data-dd-category-create="' + esc(pack.id) + '">Créer</button></div></div></details>'
   );
}

function openDictionaryAddToWords(entry, options, suppliedState) {
   const existing = findPersonalCardForEntry(entry);
   const state = suppliedState || initialDictionaryPlacementState(entry, existing);
   const query = state.filter.trim().toLocaleLowerCase("fr");
   const packs = dictionaryPlacementPackOrder(state).filter((pack) => !query || pack.name.toLocaleLowerCase("fr").includes(query));
   const frenchBlock = existing
      ? '<section class="dd-personal-definition"><div class="eyebrow">Définition française personnelle</div><p>' + (esc(existing.fr) || '<span class="muted">Non renseignée</span>') + "</p></section>"
      : '<label class="f-lab">Définition française *<input class="search" id="dd-add-fr" value="' + esc(state.french) + '" autocomplete="off"></label>' +
        (!(entry.definitionsFr || []).length ? '<p class="dd-language-notice">Traduction française indisponible dans les sources. Saisis uniquement une définition que tu as vérifiée.</p>' : "");
   const selectedHanzi = dictionaryDetailDisplayHanzi(entry);
   const identity = entry.traditional && entry.traditional !== entry.simplified
      ? (dictionaryVariantStatus(entry) !== "modern"
         ? 'Variante traditionnelle · simplifié <b>' + esc(entry.simplified) + "</b>"
         : 'Traditionnel · <b>' + esc(entry.traditional) + "</b>")
      : "";
   openSheet(
      '<section class="dd-add-words" aria-labelledby="dd-add-title"><button class="sheet-x" id="dd-add-cancel-top" type="button" aria-label="Fermer">×</button><h3 class="sh-t" id="dd-add-title">' +
         (existing ? "Déjà dans Mes mots" : "Ajouter à Mes mots") +
         '</h3><div class="dd-add-word"><b>' + esc(selectedHanzi) + '</b><span class="dd-add-word-main"><span>' +
         colorPinyin(dictionaryEntryPinyinText(entry)) + "</span>" +
         (identity ? "<small>" + identity + "</small>" : "") + "</span></div>" +
         (existing ? '<p class="dd-unique-card-note">La carte personnelle et toute sa progression SRS seront conservées.</p>' + dictionaryPlacementLocationsHtml(existing) : "") +
         frenchBlock +
         '<div class="dd-placement-head"><div><div class="eyebrow">Packs et sous-catégories</div><p>Tu peux choisir plusieurs emplacements.</p></div><button class="btn ghost" id="dd-collapse-packs" type="button">Tout replier</button></div>' +
         (db.packs.length > 5 ? '<label class="dd-pack-search"><span class="sr-only">Rechercher un pack</span><input class="search" id="dd-pack-search" value="' + esc(state.filter) + '" placeholder="Rechercher un pack…"></label>' : "") +
         '<div class="dd-add-packs" id="dd-add-packs">' +
         (packs.length ? packs.map((pack) => dictionaryPlacementPackHtml(pack, state)).join("") : '<p class="sh-note">Aucun pack correspondant.</p>') +
         '</div><details class="dd-quick-create"><summary>+ Créer rapidement un pack</summary><div class="dd-pack-create"><input class="search" id="dd-add-pack-name" placeholder="Nom du nouveau pack"><button class="btn" id="dd-add-pack-create" type="button">Créer le pack</button></div></details>' +
         (!db.packs.length ? '<p class="sh-note">Tu peux aussi ajouter le mot à Mes mots sans le ranger dans un pack.</p>' : "") +
         (state.error ? '<p class="dd-placement-error" id="dd-placement-error" role="alert">' + esc(state.error) + "</p>" : '<p class="dd-placement-error" id="dd-placement-error" role="alert" hidden></p>') +
         '<div class="dd-placement-actions"><button class="btn ghost" id="dd-add-cancel" type="button">Annuler</button><button class="btn primary" id="dd-add-confirm" type="button">' +
         (existing ? "Enregistrer les emplacements" : "Ajouter à Mes mots") +
         "</button></div></section>",
   );

   const preserveFrench = () => {
      if (!existing && $("dd-add-fr")) state.french = $("dd-add-fr").value;
   };
   document.querySelectorAll("[data-dd-pack-block]").forEach((details) => {
      details.ontoggle = () => {
         if (details.open) state.openPackIds.add(details.dataset.ddPackBlock);
         else state.openPackIds.delete(details.dataset.ddPackBlock);
      };
   });
   document.querySelectorAll("[data-dd-add-pack]").forEach((input) => {
      input.onchange = (event) => {
         event.stopPropagation();
         const packId = input.dataset.ddAddPack;
         if (input.checked) {
            state.selectedPackIds.add(packId);
            state.openPackIds.add(packId);
         } else {
            state.selectedPackIds.delete(packId);
            state.withoutCategoryPackIds.delete(packId);
            categoriesForPack(packId).forEach((category) => state.selectedCategoryIds.delete(category.id));
         }
         preserveFrench();
         openDictionaryAddToWords(entry, options, state);
      };
   });
   document.querySelectorAll("[data-dd-add-category]").forEach((input) => {
      input.onchange = () => {
         const category = categoryById(input.dataset.ddAddCategory);
         if (!category) return;
         if (input.checked) {
            state.selectedCategoryIds.add(category.id);
            state.selectedPackIds.add(category.packId);
            state.withoutCategoryPackIds.delete(category.packId);
            state.openPackIds.add(category.packId);
         } else state.selectedCategoryIds.delete(category.id);
         preserveFrench();
         openDictionaryAddToWords(entry, options, state);
      };
   });
   document.querySelectorAll("[data-dd-without-category]").forEach((input) => {
      input.onchange = () => {
         const packId = input.dataset.ddWithoutCategory;
         if (input.checked) {
            state.withoutCategoryPackIds.add(packId);
            state.selectedPackIds.add(packId);
            categoriesForPack(packId).forEach((category) => state.selectedCategoryIds.delete(category.id));
         } else state.withoutCategoryPackIds.delete(packId);
         preserveFrench();
         openDictionaryAddToWords(entry, options, state);
      };
   });
   document.querySelectorAll("[data-dd-category-create]").forEach((button) => {
      button.onclick = () => {
         if (button.disabled) return;
         const packId = button.dataset.ddCategoryCreate;
         const input = document.querySelector('[data-dd-category-name="' + CSS.escape(packId) + '"]');
         const name = input ? input.value.trim() : "";
         if (!name) return toast("Donne un nom à la sous-catégorie.");
         if (categoriesForPack(packId).some((category) => category.name.localeCompare(name, "fr", { sensitivity: "accent" }) === 0))
            return toast("Cette sous-catégorie existe déjà dans ce pack.");
         button.disabled = true;
         const category = createPersonalCategory(packId, name);
         if (!category) { button.disabled = false; return toast("Sous-catégorie non créée."); }
         state.selectedPackIds.add(packId);
         state.selectedCategoryIds.add(category.id);
         state.withoutCategoryPackIds.delete(packId);
         state.openPackIds.add(packId);
         preserveFrench();
         openDictionaryAddToWords(entry, options, state);
         toast("Sous-catégorie créée et sélectionnée.");
      };
   });
   $("dd-add-pack-create").onclick = () => {
      const button = $("dd-add-pack-create");
      if (button.disabled) return;
      const name = $("dd-add-pack-name").value.trim();
      if (!name) return toast("Donne un nom au pack.");
      if (db.packs.some((pack) => pack.name.localeCompare(name, "fr", { sensitivity: "accent" }) === 0))
         return toast("Ce pack existe déjà.");
      button.disabled = true;
      const pack = createPersonalPack(name);
      if (!pack) { button.disabled = false; return toast("Pack non créé."); }
      state.selectedPackIds.add(pack.id);
      state.openPackIds.add(pack.id);
      preserveFrench();
      openDictionaryAddToWords(entry, options, state);
      toast("Pack créé et sélectionné.");
   };
   if ($("dd-pack-search")) $("dd-pack-search").oninput = () => {
      state.filter = $("dd-pack-search").value;
      preserveFrench();
      openDictionaryAddToWords(entry, options, state);
      if ($("dd-pack-search")) {
         $("dd-pack-search").focus({ preventScroll: true });
         $("dd-pack-search").setSelectionRange(state.filter.length, state.filter.length);
      }
   };
   $("dd-collapse-packs").onclick = () => {
      state.openPackIds.clear();
      preserveFrench();
      openDictionaryAddToWords(entry, options, state);
   };
   const cancel = () => returnFromDictionaryAdd(entry, options);
   $("dd-add-cancel").onclick = cancel;
   $("dd-add-cancel-top").onclick = cancel;
   $("dd-add-confirm").onclick = () => {
      if ($("dd-add-confirm").disabled) return;
      preserveFrench();
      const undecided = Array.from(state.selectedPackIds).filter((packId) => {
         const hasCategory = categoriesForPack(packId).some((category) => state.selectedCategoryIds.has(category.id));
         return !hasCategory && !state.withoutCategoryPackIds.has(packId);
      });
      if (undecided.length) {
         const names = undecided.map((id) => db.packs.find((pack) => pack.id === id)?.name).filter(Boolean);
         state.error = "Choisis une sous-catégorie ou « Ajouter sans sous-catégorie » pour : " + names.join(", ") + ".";
         undecided.forEach((id) => state.openPackIds.add(id));
         openDictionaryAddToWords(entry, options, state);
         return;
      }
      let card = findPersonalCardForEntry(entry);
      const wasExisting = !!card;
      if (!card && !state.french.trim()) return toast("La définition française est obligatoire pour créer ta carte.");
      $("dd-add-confirm").disabled = true;
      makeBackup();
      state.withoutCategoryPackIds.forEach((packId) => {
         let category = categoriesForPack(packId).find((item) => item.name === "Tous les mots");
         if (!category) category = createPersonalCategory(packId, "Tous les mots");
         if (category) state.selectedCategoryIds.add(category.id);
      });
      if (!card) {
         card = normalizeCard({
            hz: entry.simplified,
            py: detailPinyin(entry, "marked").join(" / "),
            fr: state.french.trim(),
            cat: "",
            traditional: entry.traditional || "",
            dictionaryEntryId: entry.dictionaryEntryId || entry.id || "",
         }, false);
         if (!card) return;
         db.cards.push(card);
         invalidateDictIndex();
      }
      setCardMemberships(card.id, Array.from(state.selectedCategoryIds));
      entry.personalCard = card;
      save();
      rememberDictionaryPlacement(Array.from(state.selectedPackIds), Array.from(state.selectedCategoryIds));
      toast(wasExisting ? "Emplacements mis à jour, progression conservée." : "« " + entry.simplified + " » ajouté à Mes mots.");
      returnFromDictionaryAdd(entry, options);
   };
}

function openDictDetail(rawEntry, options) {
   const normalizedEntry = normalizeDetailEntry(rawEntry);
   const entry = attachHskMetadata({
      ...normalizedEntry,
      definitionsFr: (normalizedEntry.definitionsFr || []).slice(),
   });
   const settings = options || {};
   const currentDetail = document.querySelector("#sheet.open .dd-entry");
   if (!currentDetail || currentDetail.dataset.entryId !== String(entry.id))
      resetStrokeAutoplaySelection();
   const card = findPersonalCardForEntry(entry);
   const displayHanzi = dictionaryDetailDisplayHanzi(entry);
   const characters = Array.from(displayHanzi).filter((character) => HAN_PATTERN.test(character));
   const marked = uniqueDetailValues(detailPinyin(entry, "marked"));
   const traditional = entry.traditional && entry.traditional !== entry.simplified ? entry.traditional : "";
   const token = ++dictionaryDetailToken;
   const characterCompletionState = {
      entryId: entry.id,
      map: null,
      ready: false,
      selectedIndex: 0,
   };

   openSheet(
      '<article class="dd-entry" data-entry-id="' + esc(entry.id) + '">' +
         '<div class="cd-head"><div><div class="cd-hz" data-say="' + esc(displayHanzi) + '">' +
         esc(displayHanzi) +
         '</div>' +
         (traditional ? '<div class="dd-traditional">' + (displayHanzi === traditional ? "Simplifié · " + esc(entry.simplified) : "Traditionnel · " + esc(traditional)) + "</div>" : "") +
         '</div><div class="dd-top-actions"><button class="seal" data-say="' + esc(displayHanzi) + '" aria-label="Écouter">听</button>' +
         '<button class="dd-top-close" id="dd-close-top" data-sheet-close aria-label="Fermer la fiche">×</button></div></div>' +
         (marked.length ? '<div class="cd-py">' + marked.map(colorPinyin).join(" · ") + "</div>" : "") +
         dictionaryFrenchDefinitionsHtml(entry) +
         dictionaryCharacterInteractionHtml(characters) +
         dictionaryCharacterDetailsShellHtml(characters) +
         (card
            ? cardActionsHtml(card)
            : '<section class="dd-card-actions" aria-label="Mot personnel"><button class="btn primary wide" id="dd-addcard">+ Ajouter à Mes mots</button></section>') +
         (card && card.exHz ? exampleHtml(card) : "") +
         (card && card.note ? noteHtml(card) : "") +
         dictionaryVariantExplanationHtml(entry) +
         '<div class="dd-meta">' +
         dictionaryEntryDetailedTypeLabels(entry).map((label) => '<span class="cd-cat">' + esc(label) + "</span>").join("") +
         verifiedHskBadges(entry) +
         (Number.isFinite(entry.frequencyRank)
            ? '<span class="cd-cat">Fréquence vérifiée · ' + esc(entry.frequencyRank) + "</span>"
            : "") +
         (card ? '<span class="cd-cat jade">Dans Mes mots</span>' : "") +
         "</div>" +
         dictionaryHskSourceHtml(entry) +
         dictionaryEnglishDefinitionsHtml(entry) +
         dictionarySourcesHtml(entry) +
         '<div class="dd-related" id="dd-related"><span class="muted">Chargement des mots liés…</span></div>' +
         '<div class="sh-btns"><button class="btn ghost wide" id="dd-close">' +
         (settings.fromSearch ? "← Retour aux résultats" : "Fermer") +
         "</button></div></article>",
   );
   wireDictDetail(entry, characters, card, token, {
      ...settings,
      characterCompletionState,
   });
   if (characters.length > 1)
      loadDictionaryCharacterCompletions(
         characters,
         token,
         characterCompletionState,
         dictionaryCharacterPinyinHints(entry, characters),
      );
   if (!(entry.definitionsFr || []).length) {
      dictionaryEntryWithFrenchSibling(entry).then((resolved) => {
         if (
            token !== dictionaryDetailToken ||
            !(resolved.definitionsFr || []).length ||
            !$('dd-french-definitions') ||
            document.querySelector('#sheet.open .dd-entry')?.dataset.entryId !== String(entry.id)
         ) return;
         entry.definitionsFr = resolved.definitionsFr.slice();
         entry.__frenchSiblingEntryId = resolved.__frenchSiblingEntryId;
         $('dd-french-definitions').outerHTML = dictionaryFrenchDefinitionsHtml(entry);
         wireDictionaryFrenchDefinitions();
      }).catch(() => {
         /* Le repli anglais déjà affiché reste valable si l'index frère est indisponible. */
      });
   }
}

function dictionaryRelatedWordIsVulgar(word) {
   const english = (word.definitionsEn || []).join(" ");
   if (/\b(?:vulgar|coarse)\b/i.test(english)) return true;
   const hanzi = String(word.simplified || "");
   // Certains aperçus de variantes ne répètent pas le marqueur anglais et ne
   // contiennent qu'un renvoi. Ce repli ciblé ne s'applique qu'aux suggestions.
   return /妈卖(?:批|屄)|媽賣(?:批|屄)|(?:操|肏|屄|屌).{0,4}你|你.{0,4}(?:操|肏|屄|屌|老母)|(?:干|幹|日)你(?:妈|媽|老母)/u.test(
      hanzi,
   );
}

async function renderDictionaryRelatedWords(character, token) {
   const target = $("dd-related");
   if (!target) return;
   target.setAttribute("aria-busy", "true");
   target.innerHTML = '<span class="muted">Chargement des mots liés à ' + esc(character) + "…</span>";
   try {
      const related = await loadDictionaryCharacterLinks(character, 240);
      try { await loadHskSearchIndex(); } catch (error) { /* Le dictionnaire reste utilisable sans index HSK. */ }
      if (token !== dictionaryDetailToken || ddChar !== character || !$("dd-related")) return;
      target.setAttribute("aria-busy", "false");
      const words = related.words
         .filter(
            (word) =>
               word.simplified !== character &&
               Array.from(word.simplified).length > 1 &&
               !dictionaryRelatedWordIsVulgar(word),
         )
         .map(attachHskMetadata);
      const usefulHskLevel = (word) => {
         const exactLevel = verifiedHskLevel(word);
         if (exactLevel != null) return exactLevel;
         const withoutErhua = (value) => String(value || "").replace(/儿$/u, "");
         const normalizedWord = withoutErhua(word.simplified);
         const linkedForm = (hskDataState.searchEntries || []).find(
            (item) => withoutErhua(item.chinese) === normalizedWord,
         );
         return linkedForm ? linkedForm.firstHskLevel : null;
      };
      const compareUseful = (left, right) => {
         const leftLevel = usefulHskLevel(left) ?? 99;
         const rightLevel = usefulHskLevel(right) ?? 99;
         return leftLevel - rightLevel ||
            Number(!(left.definitionsFr || []).length) - Number(!(right.definitionsFr || []).length) ||
            Array.from(left.simplified).length - Array.from(right.simplified).length ||
            left.simplified.localeCompare(right.simplified, "zh");
      };
      const groups = [
         { label: "Commencent par " + character, words: words.filter((word) => word.simplified.startsWith(character)).sort(compareUseful).slice(0, 12) },
         { label: "Contiennent " + character, words: words.filter((word) => !word.simplified.startsWith(character)).sort(compareUseful).slice(0, 12) },
      ].filter((group) => group.words.length);
      const visibleWords = groups.flatMap((group) => group.words);
      if (!visibleWords.length) {
         target.innerHTML = '<span class="muted">Aucun mot lié classé par les sources.</span>';
         return;
      }
      target.innerHTML =
         '<div class="eyebrow">Mots associés utiles · présents dans les données</div>' +
         groups.map((group) => '<div class="dd-related-group"><small>' + esc(group.label) + '</small><div class="dd-related-list">' +
            group.words.map((word) => '<button class="chip hzchip" data-related-id="' + esc(word.id) + '">' + esc(word.simplified) + "</button>").join("") +
            "</div></div>").join("");
      target.querySelectorAll("[data-related-id]").forEach((button) => {
         button.onclick = () => {
            const word = visibleWords.find((item) => item.id === button.dataset.relatedId);
            if (!word) return;
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

function updateDictionaryPagingMode() {
   const locked = ddStrokeTab === "practice";
   const interaction = $("dd-character-interaction");
   if (interaction)
      interaction.classList.toggle("is-practice-paging-locked", locked);
   document.querySelectorAll("#dd-picker .hzchip, #seq-character-strip .hzchip").forEach((button) => {
      button.disabled = locked;
      button.setAttribute("aria-disabled", String(locked));
   });
}

function wireDictDetail(entry, characters, card, token, options) {
   wireDictionaryFrenchDefinitions();
   wireDictionaryPickerOverflowCue();
   if (characters.length) wireStrokeWorkspace();
   const completionState = options && options.characterCompletionState;
   let selectedCharacterIndex = 0;
   const selectCharacter = (index) => {
      const nextIndex = Math.max(0, Math.min(Number(index) || 0, characters.length - 1));
      const character = characters[nextIndex];
      selectedCharacterIndex = nextIndex;
      if (completionState) completionState.selectedIndex = nextIndex;
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
      const workspaceCharacters = options && Array.isArray(options.workspaceCharacters) && options.workspaceCharacters.length
         ? options.workspaceCharacters
         : characters;
      const workspaceIndex = options && Number.isInteger(options.sequenceIndex)
         ? options.sequenceIndex
         : nextIndex;
      loadDDChar(character, workspaceCharacters, {
         selectionKey,
         selectionIndex: workspaceIndex,
         stripSelectionIndex:
            options && Number.isInteger(options.sequenceIndex)
               ? options.sequenceIndex
               : nextIndex,
      });
      renderDictionaryRelatedWords(character, token);
      if (characters.length > 1 && (!completionState || completionState.ready))
         renderDictionaryCharacterStudyCard(character, token, completionState);
   };
   const moveCharacter = (delta) => {
      const nextIndex = selectedCharacterIndex + delta;
      if (nextIndex < 0 || nextIndex >= characters.length) return false;
      selectCharacter(nextIndex);
      return true;
   };
   if (characters.length) {
      selectCharacter(0);
      document.querySelectorAll("#dd-picker .hzchip").forEach((button) => {
         button.onclick = () => {
            if (ddStrokeTab === "practice") return;
            selectCharacter(Number(button.dataset.i));
         };
      });
      if ($("dd-character-prev")) $("dd-character-prev").onclick = () => moveCharacter(-1);
      if ($("dd-character-next")) $("dd-character-next").onclick = () => moveCharacter(1);
      setupSwipe(
         $("dd-character-interaction"),
         () => moveCharacter(1),
         () => moveCharacter(-1),
         {
            disabled: () => ddStrokeTab === "practice",
            canNavigate: (direction) =>
               direction === "left"
                  ? selectedCharacterIndex < characters.length - 1
                  : selectedCharacterIndex > 0,
         },
      );
      updateDictionaryPagingMode();
      if (characters.length === 1)
         renderDictionaryCharacterStudyCard(characters[0], token, {
            ready: true,
            map: new Map([[characters[0], { entry }]]),
         });
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
      if ($("dd-manage")) $("dd-manage").onclick = () => openDictionaryAddToWords(entry, options);
      if ($("dd-edit-personal")) $("dd-edit-personal").onclick = () => openCardDetail(card.id);
   }
   if ($("dd-addcard"))
      $("dd-addcard").onclick = () => openDictionaryAddToWords(entry, options);
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
