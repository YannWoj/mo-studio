"use strict";

let seq = null;

async function seqEntry(character) {
   return dictionaryCharacterStudyEntry(character);
}

function characterNavigationHtml(prefix, character, index, total) {
   const previousDisabled = index <= 0 ? " disabled" : "";
   const nextDisabled = index >= total - 1 ? " disabled" : "";
   const positionClass = prefix === "seq" ? " s-count" : "";
   const chevron = (direction) =>
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' +
      (direction === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5") +
      '"></path></svg>';
   return (
      '<nav class="character-nav" id="' + prefix + '-nav" aria-label="Navigation entre les caractères">' +
      '<button class="character-nav-button" id="' + prefix + '-prev" type="button" aria-label="Caractère précédent"' +
      previousDisabled + ">" + chevron("left") + "</button>" +
      '<strong class="character-nav-position' + positionClass + '" id="' + prefix +
      '-position" role="status" aria-live="polite" aria-atomic="true">' +
      esc(character) + " · " + (index + 1) + " / " + total + "</strong>" +
      '<button class="character-nav-button" id="' + prefix + '-next" type="button" aria-label="Caractère suivant"' +
      nextDisabled + ">" + chevron("right") + "</button></nav>"
   );
}

function updateCharacterNavigation(prefix, characters, index, stripSelector) {
   const previous = $(prefix + "-prev");
   const next = $(prefix + "-next");
   const position = $(prefix + "-position");
   if (previous) previous.disabled = index <= 0;
   if (next) next.disabled = index >= characters.length - 1;
   if (position)
      position.textContent = `${characters[index]} · ${index + 1} / ${characters.length}`;
   if (!stripSelector) return;
   document.querySelectorAll(stripSelector).forEach((button) => {
      const selected = Number(button.dataset.i) === index;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-current", selected ? "true" : "false");
   });
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
         if (selected) selected.focus({ preventScroll: true });
      }
   });
}

function moveSequence(delta) {
   if (!seq) return;
   setSequenceIndex(seq.index + delta);
}

function setupSwipe(element, onLeft, onRight, options) {
   if (!element) return;
   const settings = options || {};
   const ignoredTarget =
      "button, input, textarea, select, a, [contenteditable='true'], .stroke-focus";
   let pointerId = null;
   let startX = 0;
   let startY = 0;
   let currentX = 0;
   let currentY = 0;
   let horizontalGesture = false;
   let transitioning = false;
   const disabled = () =>
      typeof settings.disabled === "function" && settings.disabled();
   const setOffset = (value) =>
      element.style.setProperty("--character-swipe-offset", value + "px");
   const clearSelection = () => {
      const selection = window.getSelection && window.getSelection();
      if (selection && selection.rangeCount) selection.removeAllRanges();
   };
   const finish = (event, navigate) => {
      if (pointerId == null || (event && event.pointerId !== pointerId)) return;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const qualifies =
         horizontalGesture && Math.abs(deltaX) >= 54 &&
         Math.abs(deltaX) > Math.abs(deltaY) * 1.45;
      if (horizontalGesture || Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)
         clearSelection();
      const finishedPointerId = pointerId;
      pointerId = null;
      horizontalGesture = false;
      try {
         if (element.hasPointerCapture(finishedPointerId)) element.releasePointerCapture(finishedPointerId);
      } catch (error) {}
      const direction = deltaX < 0 ? "left" : "right";
      const canNavigate =
         qualifies && navigate && !disabled() &&
         (!settings.canNavigate || settings.canNavigate(direction));
      if (canNavigate) {
         transitioning = true;
         element.classList.remove("is-pointer-swiping");
         element.classList.add("is-swipe-committing");
         setOffset(direction === "left" ? -28 : 28);
         setTimeout(() => {
            if (direction === "left") onLeft();
            else onRight();
            element.classList.remove("is-swipe-committing");
            element.classList.add("is-swipe-resetting");
            setOffset(0);
            transitioning = false;
            setTimeout(() => {
               element.classList.remove("is-swipe-resetting");
            }, 130);
         }, 80);
      } else {
         element.classList.remove("is-pointer-swiping");
         element.classList.add("is-swipe-resetting");
         setOffset(0);
         setTimeout(() => element.classList.remove("is-swipe-resetting"), 130);
      }
   };
   element.addEventListener("pointerdown", (event) => {
      if (pointerId != null || transitioning || !event.isPrimary || disabled()) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const blocked = event.target.closest(ignoredTarget);
      if (blocked && !event.target.closest(".stroke-panel")) return;
      pointerId = event.pointerId;
      startX = currentX = event.clientX;
      startY = currentY = event.clientY;
      horizontalGesture = false;
   });
   element.addEventListener("pointermove", (event) => {
      if (pointerId == null || event.pointerId !== pointerId) return;
      currentX = event.clientX;
      currentY = event.clientY;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      if (!horizontalGesture && Math.abs(deltaX) >= 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
         horizontalGesture = true;
         element.classList.add("is-pointer-swiping");
         clearSelection();
         try { element.setPointerCapture(pointerId); } catch (error) {}
      }
      if (horizontalGesture) {
         setOffset(Math.max(-28, Math.min(28, deltaX * 0.18)));
         clearSelection();
         event.preventDefault();
      }
   });
   element.addEventListener("pointerup", (event) => {
      if (pointerId == null || event.pointerId !== pointerId) return;
      currentX = event.clientX;
      currentY = event.clientY;
      if (horizontalGesture) event.preventDefault();
      finish(event, true);
   });
   element.addEventListener("pointercancel", (event) => finish(event, false));
   element.addEventListener("lostpointercapture", (event) => finish(event, false));
   element.addEventListener("dragstart", (event) => event.preventDefault());
}

async function renderSequence() {
   if (!seq) return;
   const preserveScroll = !!$("seq-flash");
   const previousScrollY = window.scrollY;
   destroyStrokeWorkspace();
   const current = seq;
   const token = ++current.renderToken;
   const index = current.index;
   const character = current.chars[index];
   if (!preserveScroll)
      $("view").innerHTML =
         '<section class="sess"><div class="dictionary-loading"><span class="ink-loader"></span><b>Chargement de ' +
         esc(character) + "…</b></div></section>";
   const entry = await seqEntry(character).catch(() => normalizeDetailEntry({ hz: character }));
   if (!seq || seq !== current || token !== current.renderToken) return;
   const card = findPersonalCardForEntry(entry);
   const pinyin = dictionaryEntryPinyinText(entry);
   const definition = dictionaryResultDefinition(entry);
   $("view").innerHTML =
      '<section class="sess"><div class="s-top"><button class="s-x" id="seq-exit" aria-label="Quitter la séquence">×</button>' +
      '<div class="s-scope">Séquence · ' + esc(current.chars.join("")) + "</div></div>" +
      '<div class="s-bar"><i style="width:' + (((index + 1) / current.chars.length) * 100).toFixed(1) + '%"></i></div>' +
      '<nav class="seq-character-strip" id="seq-character-strip" aria-label="Caractères de la séquence">' +
      current.chars.map((item, index) =>
         '<button class="chip hzchip" type="button" data-i="' + index + '" data-character="' + esc(item) +
         '" aria-current="' + String(index === current.index) + '" aria-label="Afficher ' + esc(item) +
         ', position ' + (index + 1) + " sur " + current.chars.length + '">' + esc(item) + "</button>",
      ).join("") + "</nav>" +
      '<div class="flash card seq-card character-swipe-zone" id="seq-flash"><button class="seal fl-seal" data-say="' +
      esc(character) + '" aria-label="Écouter ' + esc(character) + '">听</button><div class="hanzi ink-in" data-say="' + esc(character) + '">' +
      esc(character) + "</div>" +
      (pinyin ? '<div class="pinyin">' + colorPinyin(pinyin) + "</div>" : "") +
      verifiedHskBadges(entry) +
      '<div class="sep"></div><div class="fr">' +
      (definition.english ? '<small class="search-fallback">Traduction française indisponible</small>' : "") +
      (definition.englishText ? '<span>Sens anglais de référence · ' + esc(definition.englishText) + "</span>" : esc(definition.text)) + "</div>" +
       '<div class="eyebrow">Ordre des traits</div>' + strokeBoxHtml() +
       '<div class="sh-btns"><button class="btn wide" id="dd-write" type="button">写 Écrire ce mot</button></div>' +
       (card
          ? cardActionsHtml(card)
          : '<div class="sh-btns"><button class="btn primary wide" id="dd-addcard">+ Ajouter à Mes mots</button></div>') +
      "</div>" + characterNavigationHtml("seq", character, index, current.chars.length) +
      "</section>";
   wireDictDetail(entry, [character], card, ++dictionaryDetailToken, {
      strokeSelectionKey: () => `sequence:${index}:${character}`,
      sequenceIndex: index,
      onCardStateChange: () => renderSequence(),
   });
   $("seq-exit").onclick = () => closeSequence();
   $("seq-prev").onclick = () => moveSequence(-1);
   $("seq-next").onclick = () => moveSequence(1);
   document.querySelectorAll("#seq-character-strip [data-i]").forEach((button) => {
      button.onclick = () => setSequenceIndex(Number(button.dataset.i), true);
   });
   setupSwipe(
      $("seq-flash"),
      () => moveSequence(1),
      () => moveSequence(-1),
   );
   if (preserveScroll)
      requestAnimationFrame(() => {
         const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
         window.scrollTo(0, Math.min(previousScrollY, maximum));
      });
   const nextCharacter = current.chars[index + 1];
   if (nextCharacter) {
      preloadStrokeCharacterData(nextCharacter);
      seqEntry(nextCharacter).catch(() => null);
   }
}
