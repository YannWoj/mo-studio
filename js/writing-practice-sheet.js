"use strict";

let writingPracticeSheetState = null;

function writingPracticeCharacters(value) {
   return Array.from(String(value || "").trim()).filter((character) =>
      /^\p{Script=Han}$/u.test(character),
   );
}

// Pinyin aligné sur les caractères Han : une syllabe par caractère, sinon rien.
// En révision, mieux vaut n'afficher aucun pinyin que d'en deviner un — « yī diǎnr »
// compte deux syllabes pour les trois caractères de 一点儿.
function writingPracticePinyinSyllables(characters, pinyin) {
   const syllables = String(pinyin || "").trim().split(/\s+/).filter(Boolean);
   return syllables.length === characters.length ? syllables : [];
}

// Point unique où se décide ce que la modale montre et annonce d'un caractère.
// En mode « review », rien ici ne doit contenir le caractère lui-même : ni à
// l'écran, ni pour un lecteur d'écran. Le pinyin sert de consigne ; à défaut, le
// rang du caractère dans le mot.
function writingPracticeLabels(characters, pinyin, review) {
   const syllables = review ? writingPracticePinyinSyllables(characters, pinyin) : [];
   return characters.map((character, index) => {
      if (!review)
         return {
            title: character,
            pill: character,
            pick: "Tracer " + character,
            canvas: "Zone d’essai pour " + character,
         };
      const syllable = syllables[index] || "";
      const rank = "caractère " + (index + 1) + " sur " + characters.length;
      return {
         title: syllable,
         pill: syllable || String(index + 1),
         pick: syllable ? "Tracer " + syllable : "Tracer le " + rank,
         canvas: syllable ? "Zone d’essai pour " + syllable : "Zone d’essai",
      };
   });
}

function writingPracticeCharacterPickerHtml(characters, selectedIndex, labels, review) {
   if (characters.length <= 1) return "";
   return (
      '<div class="review-stroke-characters writing-practice-character-picker" aria-label="Caractères du mot">' +
      characters.map((character, index) =>
         '<button type="button" class="review-stroke-character' +
         (review ? " writing-practice-character-review" : "") +
         '" data-writing-practice-character="' +
         index + '" aria-pressed="' + String(index === selectedIndex) +
         '" aria-label="' + esc(labels[index].pick) + '">' + esc(labels[index].pill) + "</button>",
      ).join("") +
      "</div>"
   );
}

function writingPracticeSheetHtml(word, characters, selectedIndex, preferences, labels, review) {
   const character = characters[selectedIndex];
   return (
      '<article class="review-writing-practice writing-practice-dialog" role="dialog" aria-modal="true" aria-labelledby="writing-practice-title" data-writing-practice-word="' +
      esc(word) + '" data-review-writing-character="' + esc(character) + '" data-writing-practice-mode="' +
      (review ? "review" : "search") + '">' +
      '<button class="sheet-x writing-practice-close" type="button" aria-label="Fermer">×</button>' +
      '<header class="review-writing-head"><div><p class="eyebrow">Essai rapide</p>' +
      '<h3 class="sh-t" id="writing-practice-title">Tracer <span' +
      (review ? ' class="writing-practice-title-pinyin"' : "") + ">" +
      esc(labels[selectedIndex].title) + "</span></h3></div></header>" +
      writingPracticeCharacterPickerHtml(characters, selectedIndex, labels, review) +
      '<div class="review-writing-model-controls writing-practice-sliders">' +
      '<label for="review-writing-width"><span>Trait</span><output id="review-writing-width-value">' +
      preferences.width + ' px</output><input id="review-writing-width" type="range" min="1" max="24" step="1" value="' +
      preferences.width + '"></label>' +
      '<label for="review-writing-opacity"><span>Modèle</span><output id="review-writing-opacity-value">' +
      Math.round(preferences.opacity * 100) + '%</output><input id="review-writing-opacity" type="range" min="4" max="45" step="1" value="' +
      Math.round(preferences.opacity * 100) + '"></label></div>' +
      '<div class="writing-surface review-writing-surface" id="review-writing-surface" data-grid="' + preferences.grid + '">' +
      '<div class="writing-model review-writing-model" id="review-writing-model" aria-hidden="true" style="opacity:' + preferences.opacity + '"' +
      (preferences.modelVisible ? "" : " hidden") + ">" + esc(character) + "</div>" +
      '<canvas class="writing-canvas" id="review-writing-canvas" aria-label="' + esc(labels[selectedIndex].canvas) + '" tabindex="0"></canvas>' +
      writingModelToggleButtonHtml("review-writing-model-visible", preferences.modelVisible, false, "writing-surface-model-toggle") + "</div>" +
      '<section class="review-writing-grids" aria-labelledby="review-writing-grid-title"><div class="review-writing-grid-head">' +
      '<h4 id="review-writing-grid-title">Grille</h4><small>Le tracé reste intact</small></div>' +
      '<div class="writing-grid-options">' + writingGridButtonsHtml(preferences) + "</div></section>" +
      '<div class="sh-btns review-writing-buttons"><button class="btn" type="button" id="review-writing-undo" disabled>Annuler</button>' +
      '<button class="btn" type="button" id="review-writing-clear" disabled>Recommencer</button>' +
      '<button class="btn primary writing-practice-close" type="button">Fermer</button></div></article>'
   );
}

function closeWritingPracticeSheet() {
   if (!writingPracticeSheetState) return;
   const state = writingPracticeSheetState;
   writingPracticeSheetState = null;
   if (state.controller) state.controller.destroy();
   state.listeners.abort();
   state.root.remove();
   state.inertStates.forEach(({ element, inert }) => (element.inert = inert));
   document.body.style.overflow = state.previousBodyOverflow;
   if (state.opener && state.opener.isConnected)
      state.opener.focus({ preventScroll: true });
}

function openWritingPracticeSheet(word, options) {
   const visibleWord = String(word || "").trim();
   const characters = writingPracticeCharacters(visibleWord);
   if (!characters.length || typeof createWritingCanvasController !== "function") return;
   closeWritingPracticeSheet();

   const selectedIndex = Math.max(
      0,
      Math.min(Number(options && options.initialIndex) || 0, characters.length - 1),
   );
   // « review » : ouverte depuis une séance, la modale est un exercice de rappel.
   // « search » (défaut) : ouverte depuis l'atelier des traits, comportement inchangé.
   const review = (options && options.mode) === "review";
   const labels = writingPracticeLabels(characters, options && options.pinyin, review);
   const basePreferences = writingPreferences();
   // copie de travail : masquer le modèle en révision ne doit jamais toucher le
   // réglage persisté qu'utilise la page Écrire.
   const preferences = {
      color: basePreferences.color,
      width: basePreferences.width,
      grid: basePreferences.grid,
      opacity: basePreferences.opacity,
      modelVisible: review ? false : basePreferences.modelVisible,
   };
   const slot = { actions: [], redo: [] };
   const listeners = new AbortController();
   const opener = document.activeElement;
   const inertStates = [document.querySelector(".top"), $("view"), document.querySelector(".nav"), $("sheet")]
      .filter(Boolean)
      .map((element) => ({ element, inert: element.inert }));
   const root = document.createElement("div");
   root.className = "writing-practice-backdrop" + (review ? " writing-practice-backdrop-review" : "");
   root.innerHTML = writingPracticeSheetHtml(visibleWord, characters, selectedIndex, preferences, labels, review);
   document.body.appendChild(root);
   inertStates.forEach(({ element }) => (element.inert = true));
   const previousBodyOverflow = document.body.style.overflow;
   document.body.style.overflow = "hidden";

   const state = {
      root,
      opener,
      inertStates,
      previousBodyOverflow,
      listeners,
      controller: null,
      selectedIndex,
   };
   writingPracticeSheetState = state;
   const canvas = root.querySelector("#review-writing-canvas");
   const surface = root.querySelector("#review-writing-surface");
   const undo = root.querySelector("#review-writing-undo");
   const clear = root.querySelector("#review-writing-clear");
   const updateActionState = () => {
      undo.disabled = !slot.actions.length;
      clear.disabled = !slot.actions.length;
   };
   state.controller = createWritingCanvasController({
      canvas,
      surface,
      drawingSlot: () => slot,
      preferences: () => preferences,
      selectedTool: () => "pen",
      onFinish: updateActionState,
      signal: listeners.signal,
   });

   const selectCharacter = (index) => {
      state.selectedIndex = Math.max(0, Math.min(index, characters.length - 1));
      const character = characters[state.selectedIndex];
      slot.actions.length = 0;
      slot.redo.length = 0;
      const label = labels[state.selectedIndex];
      root.querySelector(".writing-practice-dialog").dataset.reviewWritingCharacter = character;
      root.querySelector("#writing-practice-title span").textContent = label.title;
      // le modèle porte toujours le vrai caractère : c'est lui que l'œil révèle
      root.querySelector("#review-writing-model").textContent = character;
      canvas.setAttribute("aria-label", label.canvas);
      root.querySelectorAll("[data-writing-practice-character]").forEach((button) =>
         button.setAttribute(
            "aria-pressed",
            String(Number(button.dataset.writingPracticeCharacter) === state.selectedIndex),
         ),
      );
      state.controller.render();
      updateActionState();
   };

   root.querySelectorAll(".writing-practice-close").forEach((button) =>
      button.addEventListener("click", closeWritingPracticeSheet, { signal: listeners.signal }),
   );
   root.querySelectorAll("[data-writing-practice-character]").forEach((button) =>
      button.addEventListener("click", () => selectCharacter(Number(button.dataset.writingPracticeCharacter)), {
         signal: listeners.signal,
      }),
   );
   root.querySelector("#review-writing-model-visible").addEventListener("click", (event) => {
      preferences.modelVisible = !preferences.modelVisible;
      root.querySelector("#review-writing-model").hidden = !preferences.modelVisible;
      updateWritingModelToggleButton(event.currentTarget, preferences.modelVisible);
   }, { signal: listeners.signal });
   root.querySelector("#review-writing-width").addEventListener("input", (event) => {
      preferences.width = Number(event.target.value);
      root.querySelector("#review-writing-width-value").textContent = event.target.value + " px";
   }, { signal: listeners.signal });
   root.querySelector("#review-writing-opacity").addEventListener("input", (event) => {
      preferences.opacity = Number(event.target.value) / 100;
      root.querySelector("#review-writing-opacity-value").textContent = event.target.value + "%";
      root.querySelector("#review-writing-model").style.opacity = preferences.opacity;
   }, { signal: listeners.signal });
   root.querySelectorAll("[data-writing-grid]").forEach((button) =>
      button.addEventListener("click", () => {
         preferences.grid = button.dataset.writingGrid;
         surface.dataset.grid = preferences.grid;
         root.querySelectorAll("[data-writing-grid]").forEach((item) =>
            item.setAttribute("aria-pressed", String(item === button)),
         );
      }, { signal: listeners.signal }),
   );
   undo.addEventListener("click", () => {
      if (!slot.actions.length) return;
      slot.redo.push(slot.actions.pop());
      state.controller.render();
      updateActionState();
   }, { signal: listeners.signal });
   clear.addEventListener("click", () => {
      slot.actions.length = 0;
      slot.redo.length = 0;
      state.controller.render();
      updateActionState();
   }, { signal: listeners.signal });
   root.addEventListener("click", (event) => {
      if (event.target === root) closeWritingPracticeSheet();
   }, { signal: listeners.signal });
   document.addEventListener("keydown", (event) => {
      if (!writingPracticeSheetState || writingPracticeSheetState.root !== root) return;
      if (event.key === "Escape") {
         event.preventDefault();
         event.stopImmediatePropagation();
         closeWritingPracticeSheet();
         return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
         root.querySelectorAll("button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])"),
      ).filter((element) => !element.hidden && element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
         event.preventDefault();
         last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
         event.preventDefault();
         first.focus();
      }
   }, { capture: true, signal: listeners.signal });

   const closeButton = root.querySelector(".sheet-x");
   closeButton.focus({ preventScroll: true });
   requestAnimationFrame(() => {
      if (writingPracticeSheetState === state) {
         state.controller.resize();
         closeButton.focus({ preventScroll: true });
      }
   });
}
