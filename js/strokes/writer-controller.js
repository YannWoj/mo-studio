"use strict";

let ddWriter = null;
let ddWriterTarget = null;
let ddChar = null;
let ddCharacterData = null;
let ddStrokeTab = "animation";
let ddWriterToken = 0;
let ddCharacterLoadToken = 0;
let ddWorkspaceCharacters = [];
let ddWriterDocumentListeners = [];
let ddAutoplaySelectionKey = null;
let ddAutoplayPending = false;
let ddAutoplayLoadToken = 0;

function resetStrokeAutoplaySelection() {
   ddAutoplaySelectionKey = null;
   ddAutoplayPending = false;
   ddAutoplayLoadToken = 0;
}

function removeDDWriterDocumentListeners() {
   ddWriterDocumentListeners.forEach(({ type, listener, options }) =>
      document.removeEventListener(type, listener, options),
   );
   ddWriterDocumentListeners = [];
}

function createManagedDDWriter(target, character, options) {
   const captured = [];
   const originalAddEventListener = document.addEventListener;
   document.addEventListener = function (type, listener, listenerOptions) {
      if (type === "mouseup" || type === "touchend") {
         captured.push({ type, listener, options: listenerOptions });
      }
      return originalAddEventListener.call(this, type, listener, listenerOptions);
   };
   try {
      const writer = HanziWriter.create(target, character, options);
      ddWriterDocumentListeners = captured;
      return writer;
   } catch (error) {
      captured.forEach(({ type, listener, options: listenerOptions }) =>
         document.removeEventListener(type, listener, listenerOptions),
      );
      throw error;
   } finally {
      document.addEventListener = originalAddEventListener;
   }
}

function normalizedStrokeSpeed(value) {
   const speed = Number(value) || 1;
   return Math.max(0.25, Math.min(2, speed));
}

function speedOpts(speed) {
   const value = normalizedStrokeSpeed(speed);
   return {
      strokeAnimationSpeed: value,
      delayBetweenStrokes: Math.max(60, Math.round(200 / value)),
   };
}

function strokeBoxHtml() {
   const speed = normalizedStrokeSpeed(db.settings.strokeSpeed);
   const gallery = strokeGallerySettings();
   const active = ddStrokeTab;
   return (
      '<section class="stroke-workspace" aria-label="Ordre des traits">' +
      '<div class="stroke-tabs" role="tablist" aria-label="Mode d’apprentissage des traits">' +
      [
         ["animation", "Animation"],
         ["steps", "Étapes"],
         ["practice", "S’entraîner"],
      ].map(([id, label]) =>
         '<button type="button" role="tab" id="stroke-tab-' + id + '" data-stroke-tab="' + id +
         '" aria-controls="stroke-panel-' + id + '" aria-selected="' + String(active === id) +
         '" tabindex="' + (active === id ? "0" : "-1") + '">' + label + "</button>",
      ).join("") +
      "</div>" +
      '<section class="stroke-tab-panel" role="tabpanel" id="stroke-panel-animation" aria-labelledby="stroke-tab-animation"' +
      (active === "animation" ? "" : " hidden") + '>' +
      '<div class="mizi"><div id="dd-target"></div></div>' +
      '<div class="w-note" id="dd-note" role="status" aria-live="polite"></div>' +
      '<label class="f-lab" for="dd-speed">Vitesse de l’animation · <span class="speed-lab" id="dd-speed-lab">' +
      speed.toFixed(2) + '×</span></label>' +
      '<input type="range" id="dd-speed" min="0.25" max="2" step="0.05" value="' + speed + '" aria-label="Vitesse de l’animation">' +
      '<div class="sh-btns"><button class="btn primary" id="dd-anim" type="button">Rejouer</button></div>' +
      "</section>" +
      '<section class="stroke-tab-panel" role="tabpanel" id="stroke-panel-steps" aria-labelledby="stroke-tab-steps"' +
      (active === "steps" ? "" : " hidden") + '>' +
      '<div class="stroke-gallery-toolbar"><span id="dd-gallery-status" role="status" aria-live="polite">Chargement des traits réels…</span>' +
      '<div class="stroke-gallery-settings">' +
      '<label><input type="checkbox" id="dd-show-future"' + (gallery.showFuture ? " checked" : "") + '> Afficher les traits futurs</label>' +
      '<label><input type="checkbox" id="dd-show-grid"' + (gallery.showGrid ? " checked" : "") + '> Afficher la grille</label>' +
      '<label><input type="checkbox" id="dd-show-ghost"' + (gallery.showGhost ? " checked" : "") + '> Afficher le caractère fantôme</label>' +
      "</div></div>" +
      '<div class="stroke-gallery" id="dd-gallery" aria-label="Étapes cumulatives des traits"></div>' +
      '<div class="stroke-gallery-position" id="dd-gallery-position" aria-live="polite"></div>' +
      "</section>" +
      '<section class="stroke-tab-panel" role="tabpanel" id="stroke-panel-practice" aria-labelledby="stroke-tab-practice"' +
      (active === "practice" ? "" : " hidden") + '>' +
      '<div class="mizi"><div id="dd-practice-target"></div><canvas id="dd-canvas" hidden></canvas></div>' +
      '<div class="w-note" id="dd-practice-note" role="status" aria-live="polite">Trace le caractère dans le carré.</div>' +
      '<div class="sh-btns"><button class="btn primary" id="dd-quiz" type="button">Commencer</button>' +
      '<button class="btn ghost" id="dd-clear" type="button">Effacer / recommencer</button></div>' +
      "</section></section>"
   );
}

function destroyDDWriter() {
   ddWriterToken++;
   if (ddWriter && typeof ddWriter.cancelAnimation === "function") {
      try { ddWriter.cancelAnimation(); } catch (error) {}
   }
   if (ddWriter && typeof ddWriter.cancelQuiz === "function") {
      try { ddWriter.cancelQuiz(); } catch (error) {}
   }
   if (ddWriterTarget) ddWriterTarget.innerHTML = "";
   removeDDWriterDocumentListeners();
   ddWriter = null;
   ddWriterTarget = null;
}

function destroyStrokeWorkspace() {
   ddCharacterLoadToken++;
   destroyDDWriter();
   ddChar = null;
   ddCharacterData = null;
   ddWorkspaceCharacters = [];
   if (strokeGalleryObserver) strokeGalleryObserver.disconnect();
   strokeGalleryObserver = null;
   closeStrokeFocus();
}

function setStrokeWorkspaceMessage(id, message) {
   const target = $(id);
   if (target) target.textContent = message;
}

function setupFreehandPractice(message) {
   destroyDDWriter();
   const canvas = $("dd-canvas");
   const target = $("dd-practice-target");
   if (!canvas || !target) return;
   target.hidden = true;
   canvas.hidden = false;
   const size = Math.min(300, canvas.parentElement.clientWidth || 300);
   canvas.width = size;
   canvas.height = size;
   paintPad(canvas);
   setStrokeWorkspaceMessage(
      "dd-practice-note",
      message || "Données réelles indisponibles · entraînement libre sans modèle inventé.",
   );
}

function createDDWriter(mode) {
   if (!ddChar || !ddCharacterData) return;
   destroyDDWriter();
   const target = mode === "practice" ? $("dd-practice-target") : $("dd-target");
   const canvas = $("dd-canvas");
   if (!target) return;
   if (canvas) canvas.hidden = true;
   target.hidden = false;
   target.innerHTML = "";
   const size = Math.min(300, target.parentElement.clientWidth || 300);
   target.style.width = size + "px";
   target.style.height = size + "px";
   if (typeof HanziWriter === "undefined") {
      if (mode === "practice") setupFreehandPractice("Bibliothèque d’écriture indisponible · entraînement libre.");
      else setStrokeWorkspaceMessage("dd-note", "Animation indisponible.");
      return;
   }
   const token = ++ddWriterToken;
   ddWriterTarget = target;
   try {
      ddWriter = createManagedDDWriter(target, ddChar, {
         width: size,
         height: size,
         padding: 12,
         showCharacter: mode === "animation",
         showOutline: true,
         showHintAfterMisses: 2,
         strokeColor: "#17140F",
         outlineColor: "#CDBFA1",
         drawingColor: "#9E2B25",
         charDataLoader: () => ddCharacterData,
         onLoadCharDataError: () => {
            if (token !== ddWriterToken) return;
            if (mode === "practice") setupFreehandPractice();
            else setStrokeWorkspaceMessage("dd-note", "Animation indisponible pour ce caractère.");
         },
         ...speedOpts(db.settings.strokeSpeed),
      });
   } catch (error) {
      ddWriter = null;
      ddWriterTarget = null;
      if (mode === "practice")
         setupFreehandPractice("Bibliothèque d’écriture indisponible · entraînement libre.");
      else setStrokeWorkspaceMessage("dd-note", "Animation indisponible.");
      return;
   }
   if (mode === "practice") {
      setStrokeWorkspaceMessage("dd-practice-note", "Appuie sur Commencer, puis trace trait par trait.");
   } else {
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const shouldAutoplay =
         ddAutoplayPending && ddAutoplayLoadToken === ddCharacterLoadToken;
      if (shouldAutoplay) ddAutoplayPending = false;
      setStrokeWorkspaceMessage(
         "dd-note",
         reduced
            ? "Mouvement réduit activé · aucune lecture automatique."
            : shouldAutoplay
              ? "Lecture automatique des traits dans l’ordre réel."
              : `${ddCharacterData.strokeCount} traits réels.`,
      );
      if (shouldAutoplay && !reduced) {
         const writer = ddWriter;
         const token = ddWriterToken;
         try {
            const animation = writer.animateCharacter();
            if (animation && typeof animation.catch === "function") {
               animation.catch(() => {
                  if (token === ddWriterToken && writer === ddWriter)
                     setStrokeWorkspaceMessage("dd-note", "Animation indisponible pour ce caractère.");
               });
            }
         } catch (error) {
            if (token === ddWriterToken && writer === ddWriter)
               setStrokeWorkspaceMessage("dd-note", "Animation indisponible pour ce caractère.");
         }
      }
   }
}

function renderActiveStrokeTab() {
   if (!ddCharacterData) return;
   if (ddStrokeTab === "steps") renderStrokeGallery(ddCharacterData);
   else createDDWriter(ddStrokeTab);
}

function activateStrokeTab(tab, focus) {
   if (!["animation", "steps", "practice"].includes(tab)) return;
   ddStrokeTab = tab;
   document.querySelectorAll("[data-stroke-tab]").forEach((button) => {
      const selected = button.dataset.strokeTab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
   });
   document.querySelectorAll(".stroke-tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `stroke-panel-${tab}`;
   });
   destroyDDWriter();
   renderActiveStrokeTab();
   if (typeof updateDictionaryPagingMode === "function")
      updateDictionaryPagingMode();
}

function wireStrokeWorkspace() {
   const tabs = Array.from(document.querySelectorAll("[data-stroke-tab]"));
   tabs.forEach((button, index) => {
      button.onclick = () => activateStrokeTab(button.dataset.strokeTab, false);
      button.onkeydown = (event) => {
         let next = null;
         if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
         else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
         else if (event.key === "Home") next = 0;
         else if (event.key === "End") next = tabs.length - 1;
         if (next == null) return;
         event.preventDefault();
         activateStrokeTab(tabs[next].dataset.strokeTab, true);
      };
   });
   if ($("dd-speed")) {
      $("dd-speed").oninput = (event) => {
         db.settings.strokeSpeed = normalizedStrokeSpeed(event.target.value);
         $("dd-speed-lab").textContent = db.settings.strokeSpeed.toFixed(2) + "×";
         save();
      };
      $("dd-speed").onchange = () => {
         if (ddStrokeTab === "animation") createDDWriter("animation");
      };
   }
   if ($("dd-anim")) $("dd-anim").onclick = () => {
      if (!ddWriter) return toast("Animation indisponible pour ce caractère.");
      ddWriter.showCharacter({ duration: 0 });
      ddWriter.animateCharacter();
      setStrokeWorkspaceMessage("dd-note", "Lecture des traits dans l’ordre réel.");
   };
   if ($("dd-quiz")) $("dd-quiz").onclick = () => {
      if (!ddWriter) return toast("Quiz indisponible pour ce caractère.");
      if (typeof ddWriter.cancelQuiz === "function") ddWriter.cancelQuiz();
      ddWriter.hideCharacter({ duration: 0 });
      setStrokeWorkspaceMessage("dd-practice-note", "À toi : trace de mémoire, trait par trait.");
      ddWriter.quiz({
         onMistake: (strokeData) => setStrokeWorkspaceMessage(
            "dd-practice-note",
            `Essaie encore · trait ${strokeData.strokeNum + 1} sur ${ddCharacterData.strokeCount}.`,
         ),
         onCorrectStroke: (strokeData) => setStrokeWorkspaceMessage(
            "dd-practice-note",
            `Trait ${strokeData.strokeNum + 1} sur ${ddCharacterData.strokeCount} réussi.`,
         ),
         onComplete: () => setStrokeWorkspaceMessage("dd-practice-note", "Caractère réussi"),
      });
   };
   if ($("dd-clear")) $("dd-clear").onclick = () => {
      if (ddCharacterData && typeof HanziWriter !== "undefined") createDDWriter("practice");
      else {
         const canvas = $("dd-canvas");
         if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      }
   };
   const gallerySettings = strokeGallerySettings();
   [
      ["dd-show-future", "showFuture"],
      ["dd-show-grid", "showGrid"],
      ["dd-show-ghost", "showGhost"],
   ].forEach(([id, key]) => {
      if (!$(id)) return;
      $(id).onchange = (event) => {
         gallerySettings[key] = !!event.target.checked;
         save();
         if (ddCharacterData) renderStrokeGallery(ddCharacterData);
      };
   });
}

async function loadDDChar(character, characters, options) {
   const settings = options || {};
   const selectionKey = String(
      settings.selectionKey == null ? character : settings.selectionKey,
   );
   destroyDDWriter();
   const token = ++ddCharacterLoadToken;
   if (selectionKey !== ddAutoplaySelectionKey) {
      ddAutoplaySelectionKey = selectionKey;
      ddAutoplayPending = true;
   }
   ddAutoplayLoadToken = token;
   ddChar = character;
   ddCharacterData = null;
   ddWorkspaceCharacters = Array.isArray(characters) ? characters.slice() : [character];
   const workspaceIndex = Number.isInteger(settings.selectionIndex)
      ? settings.selectionIndex
      : ddWorkspaceCharacters.indexOf(character);
   const stripSelectionIndex = Number.isInteger(settings.stripSelectionIndex)
      ? settings.stripSelectionIndex
      : workspaceIndex;
   document.querySelectorAll("#dd-picker .hzchip, #seq-character-strip .hzchip").forEach((button) => {
      const buttonIndex = Number(button.dataset.i);
      const selected = button.closest("#seq-character-strip")
         ? buttonIndex === stripSelectionIndex
         : buttonIndex === workspaceIndex;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-current", selected ? "true" : "false");
   });
   setStrokeWorkspaceMessage("dd-note", `Chargement des traits réels de ${character}…`);
   setStrokeWorkspaceMessage("dd-practice-note", `Chargement des traits réels de ${character}…`);
   setStrokeWorkspaceMessage("dd-gallery-status", `Chargement des traits réels de ${character}…`);
   if ($("dd-gallery")) {
      $("dd-gallery").classList.add("is-loading");
      $("dd-gallery").setAttribute("aria-busy", "true");
      if (!$("dd-gallery").children.length)
         $("dd-gallery").innerHTML = '<div class="dictionary-loading"><span class="ink-loader"></span></div>';
   }
   try {
      const data = await loadStrokeCharacterData(character);
      if (
         token !== ddCharacterLoadToken ||
         ddChar !== character ||
         !document.querySelector(".stroke-workspace")
      ) return;
      ddCharacterData = data;
      renderActiveStrokeTab();
   } catch (error) {
      if (token !== ddCharacterLoadToken || ddChar !== character) return;
      ddAutoplayPending = false;
      renderStrokeGalleryError(character, error);
      setStrokeWorkspaceMessage("dd-note", "Animation indisponible · aucune donnée inventée.");
      setupFreehandPractice("Données réelles indisponibles · entraînement libre sans modèle inventé.");
   }
   const index = workspaceIndex;
   if (index >= 0 && ddWorkspaceCharacters[index + 1]) {
      preloadStrokeCharacterData(ddWorkspaceCharacters[index + 1]);
   }
}
