"use strict";

let seq = null;

async function seqEntry(character) {
   return dictionaryCharacterStudyEntry(character);
}

function characterChevronHtml(direction) {
   return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' +
      (direction === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5") +
      '"></path></svg>';
}

function strokeCharacterStageHtml(prefix, character, index, total, forceNavigation) {
   const previousDisabled = index <= 0 ? " disabled" : "";
   const nextDisabled = index >= total - 1 ? " disabled" : "";
   const positionClass = prefix === "seq" ? " s-count" : "";
   const hasNavigation = total > 1 || forceNavigation;
   return (
      (hasNavigation ? '<strong class="character-nav-position' + positionClass + '" id="' + prefix +
      '-position" role="status" aria-live="polite" aria-atomic="true">' +
      esc(character) + " · " + (index + 1) + " / " + total + "</strong>" : "") +
      '<div class="stroke-character-stage" id="' + prefix + '-stage">' +
      (hasNavigation ? '<button class="character-nav-button character-nav-previous" id="' + prefix +
         '-prev" type="button" aria-label="Caractère précédent"' + previousDisabled + ">" +
         characterChevronHtml("left") + "</button>" : "") +
      '<div class="stroke-character-stage-main">' + strokeBoxHtml() + "</div>" +
      (hasNavigation ? '<button class="character-nav-button character-nav-next" id="' + prefix +
         '-next" type="button" aria-label="Caractère suivant"' + nextDisabled + ">" +
         characterChevronHtml("right") + "</button>" : "") +
      "</div>"
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
      "button, input, textarea, select, a, label, [contenteditable='true'], [role='tab'], [role='slider'], .stroke-focus";
   const profiles = {
      touch: { recognition: 8, navigation: 34, dominance: 1.18, fastMinimum: 25, velocity: 0.5, maximumOffset: 34 },
      pen: { recognition: 9, navigation: 39, dominance: 1.22, fastMinimum: 29, velocity: 0.55, maximumOffset: 31 },
      mouse: { recognition: 12, navigation: 50, dominance: 1.35, fastMinimum: 42, velocity: 0.7, maximumOffset: 28 },
   };
   let pointerId = null;
   let pointerType = "mouse";
   let startX = 0;
   let startY = 0;
   let startTime = 0;
   let currentX = 0;
   let currentY = 0;
   let horizontalGesture = false;
   let verticalGesture = false;
   let transitioning = false;
   let suppressClickUntil = 0;
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
      const profile = profiles[pointerType] || profiles.mouse;
      const duration = Math.max(1, (event?.timeStamp || performance.now()) - startTime);
      const speed = Math.abs(deltaX) / duration;
      const qualifies =
         horizontalGesture && Math.abs(deltaX) > Math.abs(deltaY) * profile.dominance &&
         (Math.abs(deltaX) >= profile.navigation ||
            (Math.abs(deltaX) >= profile.fastMinimum && speed >= profile.velocity));
      if (horizontalGesture || Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)
         clearSelection();
      const finishedPointerId = pointerId;
      pointerId = null;
      horizontalGesture = false;
      verticalGesture = false;
      try {
         if (element.hasPointerCapture(finishedPointerId)) element.releasePointerCapture(finishedPointerId);
      } catch (error) {}
      const direction = deltaX < 0 ? "left" : "right";
      const canNavigate =
         qualifies && navigate && !disabled() &&
         (!settings.canNavigate || settings.canNavigate(direction));
      if (canNavigate) {
         suppressClickUntil = performance.now() + 160;
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
      pointerType = profiles[event.pointerType] ? event.pointerType : "mouse";
      startX = currentX = event.clientX;
      startY = currentY = event.clientY;
      startTime = event.timeStamp || performance.now();
      horizontalGesture = false;
      verticalGesture = false;
      try { element.setPointerCapture(pointerId); } catch (error) {}
   });
   element.addEventListener("pointermove", (event) => {
      if (pointerId == null || event.pointerId !== pointerId) return;
      currentX = event.clientX;
      currentY = event.clientY;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const profile = profiles[pointerType] || profiles.mouse;
      if (!horizontalGesture && !verticalGesture && Math.abs(deltaY) >= profile.recognition && Math.abs(deltaY) > Math.abs(deltaX) * 1.1)
         verticalGesture = true;
      if (!horizontalGesture && !verticalGesture && Math.abs(deltaX) >= profile.recognition && Math.abs(deltaX) > Math.abs(deltaY) * profile.dominance) {
         horizontalGesture = true;
         element.classList.add("is-pointer-swiping");
         clearSelection();
         try { element.setPointerCapture(pointerId); } catch (error) {}
      }
      if (horizontalGesture) {
         const direction = deltaX < 0 ? "left" : "right";
         const atLimit = settings.canNavigate && !settings.canNavigate(direction);
         const distance = deltaX * (atLimit ? 0.12 : 0.38);
         setOffset(Math.max(-profile.maximumOffset, Math.min(profile.maximumOffset, distance)));
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
   element.addEventListener("click", (event) => {
      if (performance.now() > suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
   }, true);
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
      '<div class="fr">' +
      (definition.english ? '<small class="search-fallback">Traduction française indisponible</small>' : "") +
      (definition.englishText ? '<span>Sens anglais de référence · ' + esc(definition.englishText) + "</span>" : esc(definition.text)) + "</div>" +
       '<div class="eyebrow">Ordre des traits</div>' + strokeCharacterStageHtml("seq", character, index, current.chars.length) +
       '<div class="seq-meta">' + verifiedHskBadges(entry) + "</div>" +
       '<div class="sh-btns"><button class="btn wide" id="dd-write-word" type="button">写 Écrire ce mot</button></div>' +
       (card
          ? cardActionsHtml(card)
          : '<div class="sh-btns"><button class="btn primary wide" id="dd-addcard">+ Ajouter à Mes mots</button></div>') +
      "</div></section>";
   wireDictDetail(entry, [character], card, ++dictionaryDetailToken, {
      strokeSelectionKey: () => `sequence:${index}:${character}`,
      sequenceIndex: index,
      writingWord: current.chars.join(""),
      onCardStateChange: () => renderSequence(),
   });
   $("seq-exit").onclick = () => closeSequence();
   $("seq-prev").onclick = () => moveSequence(-1);
   $("seq-next").onclick = () => moveSequence(1);
   document.querySelectorAll("#seq-character-strip [data-i]").forEach((button) => {
      button.disabled = ddStrokeTab === "practice";
      button.setAttribute("aria-disabled", String(ddStrokeTab === "practice"));
      button.onclick = () => {
         if (ddStrokeTab === "practice") return;
         setSequenceIndex(Number(button.dataset.i), true);
      };
   }, { passive: false });
   setupSwipe(
      $("seq-flash"),
      () => moveSequence(1),
      () => moveSequence(-1),
      {
         disabled: () => ddStrokeTab === "practice",
         canNavigate: (direction) => direction === "left"
            ? current.index < current.chars.length - 1
            : current.index > 0,
      },
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
