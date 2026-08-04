"use strict";

let seq = null;

async function seqEntry(character) {
   const personal = db.cards.find((card) => card.hz === character);
   if (personal) return personalCardAsDictionaryEntry(personal);
   const found = await findDictionaryEntryByHanzi(character);
   return found || normalizeDetailEntry({ hz: character });
}

function sequenceHistoryPayload() {
   return {
      moStudioSearch: true,
      mode: "sequence",
      q: srch.q,
      characters: seq ? seq.chars.join("") : "",
      sequenceIndex: seq ? seq.index : 0,
      strokeTab: ddStrokeTab,
   };
}

function openSequence(characters, options) {
   const settings = options || {};
   const list = Array.from(characters || []).filter((character) => /^\p{Script=Han}$/u.test(character));
   if (list.length < 2) return toast("La séquence demande au moins deux caractères Han réels.");
   resetStrokeAutoplaySelection();
   destroyStrokeWorkspace();
   seq = {
      chars: list,
      index: Math.max(0, Math.min(Number(settings.index) || 0, list.length - 1)),
      renderToken: 0,
   };
   if (settings.strokeTab && ["animation", "steps", "practice"].includes(settings.strokeTab)) {
      ddStrokeTab = settings.strokeTab;
   }
   closeSheet();
   document.body.classList.add("in-seq");
   document.body.style.overflow = "";
   if (!settings.fromHistory) history.pushState(sequenceHistoryPayload(), "");
   renderSequence();
   window.scrollTo(0, 0);
}

function teardownSequence() {
   destroyStrokeWorkspace();
   seq = null;
   document.body.classList.remove("in-seq");
   document.body.style.overflow = "";
}

function closeSequence(options) {
   const settings = options || {};
   if (!settings.fromHistory && history.state && history.state.mode === "sequence") {
      history.back();
      return;
   }
   teardownSequence();
   renderSearch();
}

function setSequenceIndex(index, focusStrip) {
   if (!seq) return;
   const next = Math.max(0, Math.min(index, seq.chars.length - 1));
   if (next === seq.index && $("seq-flash")) return;
   seq.index = next;
   history.replaceState(sequenceHistoryPayload(), "");
   renderSequence().then(() => {
      if (focusStrip) {
         const selected = document.querySelector('#seq-character-strip [aria-current="true"]');
         if (selected) selected.focus();
      }
   });
}

function moveSequence(delta) {
   if (!seq) return;
   setSequenceIndex(seq.index + delta);
}

function setupSwipe(element, onLeft, onRight) {
   if (!element) return;
   let x0 = null;
   let y0 = null;
   element.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, input, select, .stroke-workspace")) {
         x0 = null;
         return;
      }
      x0 = event.clientX;
      y0 = event.clientY;
   });
   element.addEventListener("pointerup", (event) => {
      if (x0 == null) return;
      const dx = event.clientX - x0;
      const dy = event.clientY - y0;
      if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) {
         if (dx < 0) onLeft();
         else onRight();
      }
      x0 = null;
      y0 = null;
   });
}

async function renderSequence() {
   if (!seq) return;
   destroyStrokeWorkspace();
   const current = seq;
   const token = ++current.renderToken;
   const index = current.index;
   const character = current.chars[index];
   $("view").innerHTML =
      '<section class="sess"><div class="dictionary-loading"><span class="ink-loader"></span><b>Chargement de ' +
      esc(character) + "…</b></div></section>";
   const entry = await seqEntry(character).catch(() => normalizeDetailEntry({ hz: character }));
   if (!seq || seq !== current || token !== current.renderToken) return;
   const card = findPersonalCardForEntry(entry);
   const pinyin = dictionaryEntryPinyinText(entry);
   const definition = dictionaryResultDefinition(entry);
   $("view").innerHTML =
      '<section class="sess"><div class="s-top"><button class="s-x" id="seq-exit" aria-label="Quitter la séquence">✕</button>' +
      '<div class="s-scope">Séquence · ' + esc(current.chars.join("")) + '</div><div class="s-count" aria-live="polite">' +
      (index + 1) + " / " + current.chars.length + "</div></div>" +
      '<div class="s-bar"><i style="width:' + (((index + 1) / current.chars.length) * 100).toFixed(1) + '%"></i></div>' +
      '<nav class="seq-character-strip" id="seq-character-strip" aria-label="Caractères de la séquence">' +
      current.chars.map((item, index) =>
         '<button class="chip hzchip" type="button" data-i="' + index + '" data-character="' + esc(item) +
         '" aria-current="' + String(index === current.index) + '" aria-label="Afficher ' + esc(item) +
         ', position ' + (index + 1) + " sur " + current.chars.length + '">' + esc(item) + "</button>",
      ).join("") + "</nav>" +
      '<div class="flash card seq-card" id="seq-flash"><button class="seal fl-seal" data-say="' +
      esc(character) + '" aria-label="Écouter ' + esc(character) + '">听</button><div class="hanzi ink-in" data-say="' + esc(character) + '">' +
      esc(character) + "</div>" +
      (pinyin ? '<div class="pinyin">' + colorPinyin(pinyin) + "</div>" : "") +
      verifiedHskBadges(entry) +
      '<div class="sep"></div><div class="fr">' +
      (definition.english ? '<small class="search-fallback">EN · repli</small>' : "") + esc(definition.text) + "</div>" +
      '<div class="eyebrow">Ordre des traits</div>' + strokeBoxHtml() +
      (card
         ? cardActionsHtml(card)
         : '<div class="sh-btns"><button class="btn primary wide" id="dd-addcard">+ Ajouter à mes cartes</button></div>') +
      '</div><div class="s-foot"><button class="btn ghost" id="seq-prev" type="button"' +
      (index === 0 ? " disabled" : "") + ">← préc.</button>" +
      '<button class="btn primary" id="seq-next" type="button">' +
      (index >= current.chars.length - 1 ? "Terminer 完" : "suivant →") +
      "</button></div></section>";
   wireDictDetail(entry, [character], card, ++dictionaryDetailToken, {
      strokeSelectionKey: () => `sequence:${index}:${character}`,
   });
   $("seq-exit").onclick = () => closeSequence();
   $("seq-prev").onclick = () => moveSequence(-1);
   $("seq-next").onclick = () => {
      if (seq && seq.index < seq.chars.length - 1) moveSequence(1);
      else closeSequence();
   };
   document.querySelectorAll("#seq-character-strip [data-i]").forEach((button) => {
      button.onclick = () => setSequenceIndex(Number(button.dataset.i), true);
   });
   setupSwipe(
      $("seq-flash"),
      () => moveSequence(1),
      () => moveSequence(-1),
   );
   const nextCharacter = current.chars[index + 1];
   if (nextCharacter) {
      preloadStrokeCharacterData(nextCharacter);
      seqEntry(nextCharacter).catch(() => null);
   }
}
